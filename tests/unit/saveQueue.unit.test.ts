import saveQueue, { QueuedSave, InvoiceData } from '../../src/lib/saveQueue';
import authStore from '../../src/stores/authStore';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  databases: jest.fn(),
};

const mockObjectStore = {
  add: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore),
};

const mockDb = {
  transaction: jest.fn(() => mockTransaction),
  createObjectStore: jest.fn(),
  objectStoreNames: { contains: jest.fn(() => false) },
};

(global as any).indexedDB = mockIndexedDB;

describe('SaveQueue', () => {
  const mockInvoice: InvoiceData = {
    amount: 100,
    description: 'Test Invoice',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    dueDate: '2024-12-31',
    items: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIndexedDB.open.mockReturnValue({
      result: mockDb,
      onsuccess: function(this: any) { this.result = mockDb; },
      onerror: null,
      onupgradeneeded: null,
    });
  });

  describe('enqueue', () => {
    it('should store invoice to IndexedDB when offline', async () => {
      authStore.setState({ isAuthenticated: false });
      
      mockObjectStore.add.mockImplementation((data) => ({
        onsuccess: function(this: any, callback: any) {
          if (callback) callback();
        },
        onerror: null,
      }));

      const queueId = await saveQueue.enqueue(mockInvoice);
      
      expect(queueId).toBeTruthy();
      expect(mockObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: mockInvoice,
          idempotencyKey: expect.any(String),
          timestamp: expect.any(Date),
          attempts: 0,
        })
      );
    });

    it('should generate unique idempotency keys', async () => {
      authStore.setState({ isAuthenticated: false });
      
      const calls: any[] = [];
      mockObjectStore.add.mockImplementation((data) => {
        calls.push(data);
        return {
          onsuccess: function(this: any, callback: any) {
            if (callback) callback();
          },
          onerror: null,
        };
      });

      await saveQueue.enqueue(mockInvoice);
      await saveQueue.enqueue({ ...mockInvoice, amount: 200 });
      
      expect(calls[0].idempotencyKey).not.toBe(calls[1].idempotencyKey);
    });

    it('should detect duplicate saves by hash', async () => {
      authStore.setState({ isAuthenticated: false });
      
      mockObjectStore.getAll.mockReturnValue({
        onsuccess: function(this: any) {
          this.result = [{
            id: 'existing-id',
            hash: 'matching-hash',
            payload: mockInvoice,
          }];
        },
      });

      // Mock hash to match
      jest.spyOn(saveQueue as any, 'findByHash').mockResolvedValue({
        id: 'existing-id',
        hash: 'matching-hash',
      });

      const queueId = await saveQueue.enqueue(mockInvoice);
      
      expect(queueId).toBe('existing-id');
      expect(mockObjectStore.add).not.toHaveBeenCalled();
    });
  });

  describe('mode switching', () => {
    it('should switch to LOCAL_ONLY when logged out', () => {
      authStore.setState({ isAuthenticated: false });
      authStore.emit('logout');
      
      expect((saveQueue as any).mode).toBe('LOCAL_ONLY');
    });

    it('should switch to SERVER_SYNC when logged in', () => {
      authStore.setState({ isAuthenticated: true });
      authStore.emit('login');
      
      expect((saveQueue as any).mode).toBe('SERVER_SYNC');
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const mockItems = [
        { 
          id: '1', 
          attempts: 0, 
          timestamp: new Date('2024-01-01') 
        },
        { 
          id: '2', 
          attempts: 2, 
          timestamp: new Date('2024-01-02') 
        },
        { 
          id: '3', 
          attempts: 0, 
          timestamp: new Date('2024-01-03') 
        },
      ];

      mockObjectStore.getAll.mockReturnValue({
        onsuccess: function(this: any) {
          this.result = mockItems;
        },
      });

      const stats = await saveQueue.getStats();
      
      expect(stats).toEqual({
        total: 3,
        pending: 2,
        failed: 1,
        oldestTimestamp: new Date('2024-01-01'),
      });
    });
  });
});