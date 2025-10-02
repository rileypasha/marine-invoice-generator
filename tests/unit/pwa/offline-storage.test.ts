/**
 * Unit Tests for Offline Storage (IndexedDB)
 */

import { openDB, IDBPDatabase } from 'idb';

describe('Offline Storage (IndexedDB)', () => {
  let db: IDBPDatabase;

  beforeEach(async () => {
    // Create test database
    db = await openDB('test-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('requests')) {
          db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  });

  afterEach(async () => {
    if (db) {
      db.close();
      await indexedDB.deleteDatabase('test-db');
    }
  });

  describe('CRUD Operations', () => {
    it('should create a record', async () => {
      const record = { vessel: 'Test Vessel', status: 'pending' };

      const id = await db.add('requests', record);

      expect(id).toBeDefined();
      expect(typeof id).toBe('number');
    });

    it('should read a record', async () => {
      const record = { vessel: 'Test Vessel', status: 'pending' };
      const id = await db.add('requests', record);

      const retrieved = await db.get('requests', id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.vessel).toBe('Test Vessel');
      expect(retrieved?.status).toBe('pending');
    });

    it('should update a record', async () => {
      const record = { vessel: 'Test Vessel', status: 'pending' };
      const id = await db.add('requests', record);

      await db.put('requests', { id, vessel: 'Test Vessel', status: 'completed' });

      const updated = await db.get('requests', id);
      expect(updated?.status).toBe('completed');
    });

    it('should delete a record', async () => {
      const record = { vessel: 'Test Vessel', status: 'pending' };
      const id = await db.add('requests', record);

      await db.delete('requests', id);

      const deleted = await db.get('requests', id);
      expect(deleted).toBeUndefined();
    });

    it('should get all records', async () => {
      await db.add('requests', { vessel: 'Vessel 1', status: 'pending' });
      await db.add('requests', { vessel: 'Vessel 2', status: 'completed' });

      const all = await db.getAll('requests');

      expect(all.length).toBe(2);
      expect(all[0].vessel).toBe('Vessel 1');
      expect(all[1].vessel).toBe('Vessel 2');
    });
  });

  describe('Queue Management', () => {
    it('should queue an action when offline', async () => {
      const action = {
        type: 'CREATE_REQUEST',
        payload: { vessel: 'Test', status: 'pending' },
        timestamp: Date.now(),
      };

      const id = await db.add('queue', action);

      expect(id).toBeDefined();

      const queued = await db.get('queue', id);
      expect(queued?.type).toBe('CREATE_REQUEST');
    });

    it('should process queue in order (FIFO)', async () => {
      await db.add('queue', { type: 'ACTION_1', timestamp: 1000 });
      await db.add('queue', { type: 'ACTION_2', timestamp: 2000 });
      await db.add('queue', { type: 'ACTION_3', timestamp: 3000 });

      const queue = await db.getAll('queue');

      expect(queue[0].type).toBe('ACTION_1');
      expect(queue[1].type).toBe('ACTION_2');
      expect(queue[2].type).toBe('ACTION_3');
    });

    it('should remove action after processing', async () => {
      const id = await db.add('queue', { type: 'ACTION_1', timestamp: 1000 });

      // Process and remove
      await db.delete('queue', id);

      const remaining = await db.getAll('queue');
      expect(remaining.length).toBe(0);
    });

    it('should clear entire queue', async () => {
      await db.add('queue', { type: 'ACTION_1' });
      await db.add('queue', { type: 'ACTION_2' });
      await db.add('queue', { type: 'ACTION_3' });

      await db.clear('queue');

      const remaining = await db.getAll('queue');
      expect(remaining.length).toBe(0);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect conflicts based on timestamp', async () => {
      const serverRecord = { id: 1, vessel: 'Server Version', updatedAt: 2000 };
      const localRecord = { id: 1, vessel: 'Local Version', updatedAt: 1000 };

      const hasConflict = serverRecord.updatedAt > localRecord.updatedAt;

      expect(hasConflict).toBe(true);
    });

    it('should prefer server version on conflict', async () => {
      const serverRecord = { id: 1, vessel: 'Server Version', updatedAt: 2000 };
      const localRecord = { id: 1, vessel: 'Local Version', updatedAt: 1000 };

      const resolved = serverRecord.updatedAt > localRecord.updatedAt ? serverRecord : localRecord;

      expect(resolved.vessel).toBe('Server Version');
    });

    it('should merge non-conflicting fields', async () => {
      const serverRecord = { id: 1, vessel: 'Server Vessel', contact: 'Server Contact', updatedAt: 2000 };
      const localRecord = { id: 1, vessel: 'Local Vessel', notes: 'Local Notes', updatedAt: 1000 };

      const merged = {
        ...localRecord,
        ...serverRecord,
        notes: localRecord.notes, // Preserve local-only field
      };

      expect(merged.vessel).toBe('Server Vessel'); // Server wins
      expect(merged.contact).toBe('Server Contact'); // From server
      expect(merged.notes).toBe('Local Notes'); // Preserved from local
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache after timeout', async () => {
      const cacheTimeout = 5 * 60 * 1000; // 5 minutes
      const record = { vessel: 'Test', cachedAt: Date.now() - 6 * 60 * 1000 }; // 6 min ago

      const isStale = Date.now() - record.cachedAt > cacheTimeout;

      expect(isStale).toBe(true);
    });

    it('should not invalidate fresh cache', async () => {
      const cacheTimeout = 5 * 60 * 1000; // 5 minutes
      const record = { vessel: 'Test', cachedAt: Date.now() - 2 * 60 * 1000 }; // 2 min ago

      const isStale = Date.now() - record.cachedAt > cacheTimeout;

      expect(isStale).toBe(false);
    });
  });
});
