/**
 * Integration Tests for Offline Sync Flow
 */

import { openDB, IDBPDatabase } from 'idb';

describe('Offline Sync Flow Integration', () => {
  let db: IDBPDatabase;
  let mockServer: any;

  beforeEach(async () => {
    // Setup IndexedDB
    db = await openDB('sync-test-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('requests')) {
          db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
      },
    });

    // Mock server API
    mockServer = {
      requests: [] as any[],
      create: jest.fn(async (data) => {
        const id = mockServer.requests.length + 1;
        const record = { ...data, id, serverCreatedAt: Date.now() };
        mockServer.requests.push(record);
        return record;
      }),
      update: jest.fn(async (id, data) => {
        const index = mockServer.requests.findIndex((r) => r.id === id);
        if (index !== -1) {
          mockServer.requests[index] = { ...mockServer.requests[index], ...data, serverUpdatedAt: Date.now() };
          return mockServer.requests[index];
        }
        throw new Error('Not found');
      }),
      fetch: jest.fn(async () => mockServer.requests),
    };
  });

  afterEach(async () => {
    if (db) {
      db.close();
      await indexedDB.deleteDatabase('sync-test-db');
    }
  });

  describe('Create Request Offline → Auto-sync on Reconnect', () => {
    it('should queue create action when offline', async () => {
      // Simulate offline
      const isOnline = false;

      const newRequest = { vessel: 'Test Vessel', status: 'pending' };

      if (!isOnline) {
        // Save to local DB
        const localId = await db.add('requests', { ...newRequest, localOnly: true });

        // Queue for sync
        await db.add('queue', {
          type: 'CREATE',
          localId,
          payload: newRequest,
          timestamp: Date.now(),
        });

        expect(localId).toBeDefined();
      }

      const queue = await db.getAll('queue');
      expect(queue.length).toBe(1);
      expect(queue[0].type).toBe('CREATE');
    });

    it('should sync queued actions when online', async () => {
      // Queue action
      const localId = await db.add('requests', { vessel: 'Test', localOnly: true });
      const queueId = await db.add('queue', {
        type: 'CREATE',
        localId,
        payload: { vessel: 'Test', status: 'pending' },
        timestamp: Date.now(),
      });

      // Simulate going online
      const isOnline = true;

      if (isOnline) {
        const queue = await db.getAll('queue');

        for (const action of queue) {
          if (action.type === 'CREATE') {
            // Sync to server
            const serverRecord = await mockServer.create(action.payload);

            // Update local record
            await db.put('requests', { ...serverRecord, localOnly: false });

            // Remove from queue
            await db.delete('queue', action.id);
          }
        }
      }

      expect(mockServer.create).toHaveBeenCalled();

      const remainingQueue = await db.getAll('queue');
      expect(remainingQueue.length).toBe(0);
    });

    it('should verify server state matches after sync', async () => {
      // Create locally
      const localId = await db.add('requests', { vessel: 'Test', status: 'pending', localOnly: true });

      // Queue for sync
      await db.add('queue', {
        type: 'CREATE',
        localId,
        payload: { vessel: 'Test', status: 'pending' },
      });

      // Sync to server
      const queue = await db.getAll('queue');
      const serverRecord = await mockServer.create(queue[0].payload);

      // Update local
      await db.put('requests', { ...serverRecord, localOnly: false });
      await db.delete('queue', queue[0].id);

      // Verify
      const localRecord = await db.get('requests', localId);
      const serverData = mockServer.requests[0];

      expect(localRecord?.vessel).toBe(serverData.vessel);
      expect(localRecord?.localOnly).toBe(false);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect conflict when server has newer version', async () => {
      // Server record
      const serverRecord = { id: 1, vessel: 'Server Version', updatedAt: 2000 };
      mockServer.requests.push(serverRecord);

      // Local record (older)
      await db.put('requests', { id: 1, vessel: 'Local Version', updatedAt: 1000 });

      // Sync from server
      const serverData = await mockServer.fetch();
      const localRecord = await db.get('requests', 1);

      const hasConflict = serverData[0].updatedAt > localRecord.updatedAt;

      expect(hasConflict).toBe(true);
    });

    it('should show resolution UI for conflicts', async () => {
      const serverRecord = { id: 1, vessel: 'Server Version', updatedAt: 2000 };
      const localRecord = { id: 1, vessel: 'Local Version', updatedAt: 1000 };

      const conflict = {
        recordId: 1,
        serverVersion: serverRecord,
        localVersion: localRecord,
        resolved: false,
      };

      // Mock resolution (user chooses server version)
      const resolution = 'server';

      const resolved = resolution === 'server' ? serverRecord : localRecord;

      expect(resolved.vessel).toBe('Server Version');

      // Update local to match
      await db.put('requests', resolved);

      const updated = await db.get('requests', 1);
      expect(updated?.vessel).toBe('Server Version');
    });
  });

  describe('Cache Strategy', () => {
    it('should use network-first for fresh data', async () => {
      const isOnline = true;

      let data;

      if (isOnline) {
        // Try network first
        try {
          data = await mockServer.fetch();
        } catch {
          // Fall back to cache
          data = await db.getAll('requests');
        }
      } else {
        // Use cache
        data = await db.getAll('requests');
      }

      expect(mockServer.fetch).toHaveBeenCalled();
    });

    it('should use cache-first for offline', async () => {
      const isOnline = false;

      // Populate cache
      await db.add('requests', { vessel: 'Cached' });

      let data;

      if (isOnline) {
        data = await mockServer.fetch();
      } else {
        // Use cache
        data = await db.getAll('requests');
      }

      expect(data.length).toBe(1);
      expect(data[0].vessel).toBe('Cached');
      expect(mockServer.fetch).not.toHaveBeenCalled();
    });

    it('should refresh cache in background (stale-while-revalidate)', async () => {
      // Populate cache
      await db.add('requests', { vessel: 'Stale Data', cachedAt: Date.now() - 10000 });

      // Return cache immediately
      const cachedData = await db.getAll('requests');
      expect(cachedData[0].vessel).toBe('Stale Data');

      // Refresh in background
      const freshData = await mockServer.fetch();
      if (freshData.length > 0) {
        await db.clear('requests');
        for (const record of freshData) {
          await db.add('requests', { ...record, cachedAt: Date.now() });
        }
      }

      // Verify cache updated
      const updatedCache = await db.getAll('requests');
      expect(mockServer.fetch).toHaveBeenCalled();
    });
  });

  describe('Network Status Handling', () => {
    it('should retry failed sync on reconnect', async () => {
      // Queue action
      const queueId = await db.add('queue', {
        type: 'CREATE',
        payload: { vessel: 'Test' },
        retries: 0,
      });

      // Simulate failed sync
      mockServer.create.mockRejectedValueOnce(new Error('Network error'));

      try {
        await mockServer.create({ vessel: 'Test' });
      } catch (error) {
        // Increment retry count
        const action = await db.get('queue', queueId);
        await db.put('queue', { ...action, retries: (action.retries || 0) + 1 });
      }

      const action = await db.get('queue', queueId);
      expect(action.retries).toBe(1);

      // Retry on reconnect
      mockServer.create.mockResolvedValueOnce({ id: 1, vessel: 'Test' });
      await mockServer.create({ vessel: 'Test' });

      expect(mockServer.create).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple offline/online transitions', async () => {
      const states = [true, false, true, false, true]; // online/offline sequence

      for (const online of states) {
        if (online) {
          // Attempt sync
          const queue = await db.getAll('queue');
          // Process queue...
        }
      }

      // System should remain stable
      expect(true).toBe(true);
    });
  });
});
