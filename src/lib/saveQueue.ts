import { generateIdempotencyKey, debounce, hashObject } from '../utils/idempotency';
import authStore from '../stores/authStore';
import apiClient from './apiClient';
import { TIMEOUTS_ENV, PERFORMANCE_ENV, DATABASE } from '../config/constants';

/**
 * LRU Cache implementation for efficient hash lookups
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = PERFORMANCE_ENV.LRU_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value as K | undefined;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Utility function to split array into chunks for batch processing
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export interface InvoiceData {
  id?: string;
  invoiceNumber?: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  dueDate: string;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
  [key: string]: any;
}

export interface QueuedSave {
  id: string;
  invoiceId: string;
  idempotencyKey: string;
  payload: InvoiceData;
  timestamp: Date;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  hash: string;
}

export type QueueMode = 'LOCAL_ONLY' | 'SERVER_SYNC';

class SaveQueue {
  private db: IDBDatabase | null = null;
  private mode: QueueMode = 'LOCAL_ONLY';
  private readonly dbName = DATABASE.INDEXEDDB_NAME;
  private readonly storeName = DATABASE.STORE_NAME;
  private readonly version = DATABASE.INDEXEDDB_VERSION;
  private isProcessing = false;
  private debouncedSave: ReturnType<typeof debounce>;

  // Performance optimizations
  private hashIndex = new LRUCache<string, string>(); // hash -> id mapping
  private pendingBatch: QueuedSave[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private performanceMetrics = {
    queryCount: 0,
    batchCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor() {
    this.initDB();
    this.debouncedSave = debounce(this.processSave.bind(this), TIMEOUTS_ENV.AUTO_SAVE_DEBOUNCE);

    // Listen for auth state changes
    authStore.on('login', () => this.onAuthStateChange(true));
    authStore.on('logout', () => this.onAuthStateChange(false));
    authStore.on('authRequired', () => this.onAuthStateChange(false));

    // Set initial mode based on auth state
    this.mode = authStore.isAuthenticated ? 'SERVER_SYNC' : 'LOCAL_ONLY';

    // Initialize hash index from existing data
    this.initHashIndex();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create or upgrade the object store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('invoiceId', 'invoiceId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
          store.createIndex('hash', 'hash', { unique: false }); // New hash index for O(1) lookups
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  private async onAuthStateChange(isAuthenticated: boolean): Promise<void> {
    this.mode = isAuthenticated ? 'SERVER_SYNC' : 'LOCAL_ONLY';
    
    if (isAuthenticated) {
      // Show review modal for queued saves
      const queued = await this.getAll();
      if (queued.length > 0) {
        this.showReviewModal(queued);
      }
    }
  }

  async enqueue(invoice: InvoiceData): Promise<string> {
    const startTime = performance.now();
    const hash = hashObject(invoice);

    // O(1) hash lookup using LRU cache
    const existingId = this.hashIndex.get(hash);
    if (existingId) {
      this.performanceMetrics.cacheHits++;
      console.log('📦 Duplicate save detected (cached), reusing existing entry');
      return existingId;
    }
    this.performanceMetrics.cacheMisses++;

    // Check database for existing hash (fallback)
    const existing = await this.findByHashOptimized(hash);
    if (existing) {
      this.hashIndex.set(hash, existing.id); // Cache for future lookups
      console.log('📦 Duplicate save detected (DB), updating cache');
      return existing.id;
    }

    const id = `save_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const idempotencyKey = generateIdempotencyKey(invoice);

    const queuedSave: QueuedSave = {
      id,
      invoiceId: invoice.id || `temp_${Date.now()}`,
      idempotencyKey,
      payload: invoice,
      timestamp: new Date(),
      attempts: 0,
      hash,
    };

    // Add to batch for efficient processing
    this.pendingBatch.push(queuedSave);
    this.hashIndex.set(hash, id); // Cache immediately
    this.scheduleBatchProcess();

    const duration = performance.now() - startTime;
    console.log(`📦 Queued save ${id} (${duration.toFixed(2)}ms) for ${this.mode === 'LOCAL_ONLY' ? 'local storage' : 'sync'}`);

    if (this.mode === 'SERVER_SYNC' && authStore.isAuthenticated) {
      this.debouncedSave(queuedSave);
    }

    return id;
  }

  /**
   * Optimized hash lookup using IndexedDB hash index (O(1) vs O(n))
   */
  private async findByHashOptimized(hash: string): Promise<QueuedSave | null> {
    const db = await this.ensureDB();
    this.performanceMetrics.queryCount++;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const hashIndex = store.index('hash');
      const request = hashIndex.get(hash);

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            ...request.result,
            timestamp: new Date(request.result.timestamp),
            lastAttempt: request.result.lastAttempt ? new Date(request.result.lastAttempt) : undefined,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Failed to find by hash:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Initialize hash index from existing database entries
   * Optimized to avoid O(n) getAll() call in production
   */
  private async initHashIndex(): Promise<void> {
    try {
      // Use cursor-based approach for better performance with large datasets
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      let count = 0;

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const item = cursor.value;
            this.hashIndex.set(item.hash, item.id);
            count++;
            cursor.continue();
          } else {
            console.log(`🔍 Initialized hash index with ${count} entries (cursor-based)`);
            resolve();
          }
        };

        request.onerror = () => {
          console.error('Failed to initialize hash index:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to initialize hash index:', error);
    }
  }

  /**
   * Schedule batch processing with configurable delay
   */
  private scheduleBatchProcess(): void {
    if (this.batchTimeout) return;

    this.batchTimeout = setTimeout(() => {
      this.processBatch();
      this.batchTimeout = null;
    }, TIMEOUTS_ENV.INDEXEDDB_BATCH_DELAY);
  }

  /**
   * Process queued saves in batches for better performance
   */
  private async processBatch(): Promise<void> {
    if (this.pendingBatch.length === 0) return;

    const batch = [...this.pendingBatch];
    this.pendingBatch = [];
    this.performanceMetrics.batchCount++;

    const startTime = performance.now();
    console.log(`📦 Processing batch of ${batch.length} saves`);

    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Add all items in single transaction
      const promises = batch.map(item =>
        new Promise<void>((resolve, reject) => {
          const request = store.add(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
      );

      await Promise.all(promises);

      const duration = performance.now() - startTime;
      console.log(`✅ Batch processed successfully (${duration.toFixed(2)}ms)`);

    } catch (error) {
      console.error('Batch processing failed:', error);
      // Re-queue failed items
      this.pendingBatch.unshift(...batch);
      this.scheduleBatchProcess();
    }
  }

  async getAll(): Promise<QueuedSave[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
          lastAttempt: item.lastAttempt ? new Date(item.lastAttempt) : undefined,
        }));
        resolve(items);
      };

      request.onerror = () => {
        console.error('Failed to get queued saves:', request.error);
        reject(request.error);
      };
    });
  }

  async getById(id: string): Promise<QueuedSave | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            ...request.result,
            timestamp: new Date(request.result.timestamp),
            lastAttempt: request.result.lastAttempt ? new Date(request.result.lastAttempt) : undefined,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Failed to get queued save:', request.error);
        reject(request.error);
      };
    });
  }

  async remove(id: string): Promise<void> {
    const db = await this.ensureDB();

    // Get item to remove from hash index
    const item = await this.getById(id);
    if (item) {
      this.hashIndex.delete(item.hash);
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`🗑️ Removed queued save ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to remove queued save:', request.error);
        reject(request.error);
      };
    });
  }

  async update(id: string, updates: Partial<QueuedSave>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Queued save ${id} not found`);
    }

    const db = await this.ensureDB();
    const updated = { ...existing, ...updates };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(updated);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to update queued save:', request.error);
        reject(request.error);
      };
    });
  }

  private async processSave(queuedSave: QueuedSave): Promise<void> {
    if (!authStore.isAuthenticated || this.mode === 'LOCAL_ONLY') {
      return;
    }

    try {
      console.log(`📤 Processing queued save ${queuedSave.id}`);
      
      await apiClient.post('/api/v1/invoice/save', queuedSave.payload, {
        idempotencyKey: queuedSave.idempotencyKey,
      });

      await this.remove(queuedSave.id);
      console.log(`✅ Successfully synced ${queuedSave.id}`);
      
    } catch (error: any) {
      console.error(`❌ Failed to sync ${queuedSave.id}:`, error);
      
      await this.update(queuedSave.id, {
        attempts: queuedSave.attempts + 1,
        lastAttempt: new Date(),
        error: error.message,
      });

      // Don't retry auth errors
      if (error.name === 'AuthRequiredError') {
        this.mode = 'LOCAL_ONLY';
      }
    }
  }

  /**
   * Optimized flush with parallel batch processing
   */
  async flush(selectedIds?: string[]): Promise<{ success: number; failed: number }> {
    if (!authStore.isAuthenticated) {
      console.warn('Cannot flush queue: not authenticated');
      return { success: 0, failed: 0 };
    }

    this.isProcessing = true;
    const startTime = performance.now();

    const items = await this.getAll();
    const toProcess = selectedIds
      ? items.filter(item => selectedIds.includes(item.id))
      : items;

    console.log(`📤 Starting optimized flush of ${toProcess.length} items`);

    // Process in parallel batches for better performance
    const batches = chunk(toProcess, PERFORMANCE_ENV.INDEXEDDB_PARALLEL_BATCH_SIZE);
    let success = 0;
    let failed = 0;

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(item => this.processQueueItem(item))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          success++;
          // Remove from hash index on successful processing
          this.hashIndex.delete(batch[index].hash);
        } else {
          failed++;
          console.error(`Failed to process ${batch[index].id}:`, result.reason);
        }
      });
    }

    this.isProcessing = false;
    const duration = performance.now() - startTime;
    console.log(`📦 Optimized flush complete: ${success} success, ${failed} failed (${duration.toFixed(2)}ms)`);

    return { success, failed };
  }

  /**
   * Process individual queue item with error handling
   */
  private async processQueueItem(item: QueuedSave): Promise<void> {
    try {
      await apiClient.post('/api/v1/invoice/save', item.payload, {
        idempotencyKey: item.idempotencyKey,
      });

      await this.remove(item.id);
      console.log(`✅ Successfully processed ${item.id}`);

    } catch (error: any) {
      await this.update(item.id, {
        attempts: item.attempts + 1,
        lastAttempt: new Date(),
        error: error.message,
      });
      throw error;
    }
  }

  private showReviewModal(items: QueuedSave[]): void {
    // Emit event for UI to handle
    const event = new CustomEvent('queuedSavesReview', {
      detail: { items },
    });
    window.dispatchEvent(event);
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();

    // Clear hash index
    this.hashIndex.clear();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🗑️ Cleared all queued saves and hash index');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear queue:', request.error);
        reject(request.error);
      };
    });
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    failed: number;
    oldestTimestamp?: Date;
  }> {
    const items = await this.getAll();
    
    return {
      total: items.length,
      pending: items.filter(item => item.attempts === 0).length,
      failed: items.filter(item => item.attempts > 0).length,
      oldestTimestamp: items.length > 0 
        ? new Date(Math.min(...items.map(item => item.timestamp.getTime())))
        : undefined,
    };
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      hashIndexSize: this.hashIndex.size(),
      pendingBatchSize: this.pendingBatch.length,
      isProcessing: this.isProcessing,
      mode: this.mode,
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      queryCount: 0,
      batchCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  destroy(): void {
    // Clear batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Process any remaining pending batch
    if (this.pendingBatch.length > 0) {
      console.warn(`⚠️ Destroying SaveQueue with ${this.pendingBatch.length} pending items`);
    }

    // Clear hash index
    this.hashIndex.clear();

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const saveQueue = new SaveQueue();
export default saveQueue;
