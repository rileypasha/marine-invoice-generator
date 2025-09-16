import authStore, { AuthRequiredError } from '../stores/authStore';
import apiClient from '../lib/apiClient';
import saveQueue, { InvoiceData } from '../lib/saveQueue';
import { generateIdempotencyKey, debounce } from '../utils/idempotency';
import { TIMEOUTS_ENV, PERFORMANCE_ENV } from '../config/constants';

/**
 * Activity tracker for adaptive auto-save
 */
class ActivityTracker {
  private lastEditTime = 0;
  private editCount = 0;
  private lastUserActivity = 0;
  private activeThreshold = PERFORMANCE_ENV.ACTIVE_EDITING_THRESHOLD;
  private editThreshold = PERFORMANCE_ENV.EDIT_COUNT_THRESHOLD;

  recordEdit(): void {
    const now = Date.now();
    this.lastEditTime = now;
    this.lastUserActivity = now;
    this.editCount++;
  }

  recordActivity(): void {
    this.lastUserActivity = Date.now();
  }

  isActivelyEditing(): boolean {
    const timeSinceLastEdit = Date.now() - this.lastEditTime;
    return this.editCount >= this.editThreshold && timeSinceLastEdit < this.activeThreshold;
  }

  isUserActive(): boolean {
    const timeSinceActivity = Date.now() - this.lastUserActivity;
    return timeSinceActivity < this.activeThreshold;
  }

  getAdaptiveInterval(): number {
    if (this.isActivelyEditing() && this.isUserActive()) {
      return TIMEOUTS_ENV.AUTO_SAVE_ACTIVE_INTERVAL;
    }
    return TIMEOUTS_ENV.AUTO_SAVE_BASE_INTERVAL;
  }

  reset(): void {
    this.editCount = 0;
    this.lastEditTime = 0;
  }

  getStats() {
    return {
      editCount: this.editCount,
      lastEditTime: this.lastEditTime,
      lastUserActivity: this.lastUserActivity,
      isActivelyEditing: this.isActivelyEditing(),
      isUserActive: this.isUserActive(),
      currentInterval: this.getAdaptiveInterval(),
    };
  }
}

export interface SaveResult {
  success: boolean;
  id?: string;
  queueId?: string;
  error?: string;
  savedLocally?: boolean;
}

export interface InvoiceServiceOptions {
  autoSaveInterval?: number;
  enableAutoSave?: boolean;
  adaptiveAutoSave?: boolean;
}

export interface PerformanceMetrics {
  autoSaveCount: number;
  autoSaveSkipped: number;
  manualSaveCount: number;
  averageSaveTime: number;
  lastSaveTime: number;
}

class InvoiceService {
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private currentInvoice: InvoiceData | null = null;
  private debouncedAutoSave: ReturnType<typeof debounce>;
  private options: InvoiceServiceOptions;
  private activityTracker = new ActivityTracker();
  private hasUnsavedChanges = false;
  private performanceMetrics: PerformanceMetrics = {
    autoSaveCount: 0,
    autoSaveSkipped: 0,
    manualSaveCount: 0,
    averageSaveTime: 0,
    lastSaveTime: 0,
  };
  private saveTimes: number[] = [];

  constructor(options: InvoiceServiceOptions = {}) {
    this.options = {
      autoSaveInterval: TIMEOUTS_ENV.AUTO_SAVE_BASE_INTERVAL,
      enableAutoSave: true,
      adaptiveAutoSave: true,
      ...options,
    };

    this.debouncedAutoSave = debounce(this.autoSave.bind(this), TIMEOUTS_ENV.AUTO_SAVE_DEBOUNCE);

    // Listen for auth events
    authStore.on('authRequired', () => this.handleAuthLost());
    authStore.on('sessionExpired', () => this.handleSessionExpired());

    // Track user activity for adaptive auto-save
    this.setupActivityTracking();
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    const event = new CustomEvent('showToast', {
      detail: { message, type },
    });
    window.dispatchEvent(event);
    console.log(`🔔 [${type.toUpperCase()}] ${message}`);
  }

  async save(invoice: InvoiceData, isAutoSave = false): Promise<SaveResult> {
    const saveId = `save_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const startTime = performance.now();

    console.log(`💾 [${saveId}] Starting ${isAutoSave ? 'auto' : 'manual'} save`);

    // Skip auto-save if no changes and user is inactive
    if (isAutoSave && this.shouldSkipAutoSave()) {
      this.performanceMetrics.autoSaveSkipped++;
      console.log(`⏭️ [${saveId}] Skipping auto-save (no changes or user inactive)`);
      return { success: true, savedLocally: false };
    }

    try {
      // Check auth state first
      if (!authStore.isAuthenticated) {
        console.log(`📦 [${saveId}] Not authenticated, saving locally`);
        const queueId = await saveQueue.enqueue(invoice);
        
        const stats = await saveQueue.getStats();
        const message = isAutoSave 
          ? `Draft saved locally (${stats.total} pending)`
          : `Login to save to server. Draft saved locally.`;
        
        this.showToast(message, 'warning');
        
        return {
          success: true,
          queueId,
          savedLocally: true,
        };
      }

      // Attempt server save
      console.log(`📤 [${saveId}] Attempting server save`);
      const idempotencyKey = generateIdempotencyKey(invoice);
      
      const response = await apiClient.post<{ id: string; message?: string }>(
        '/api/v1/invoice/save',
        invoice,
        { idempotencyKey }
      );

      const duration = performance.now() - startTime;
      this.recordSaveMetrics(duration, isAutoSave, false);

      console.log(`✅ [${saveId}] Server save successful (${duration.toFixed(2)}ms)`);

      if (!isAutoSave) {
        this.showToast('Invoice saved successfully', 'success');
      }

      this.hasUnsavedChanges = false;

      return {
        success: true,
        id: response.id,
        savedLocally: false,
      };
      
    } catch (error: any) {
      console.error(`❌ [${saveId}] Save failed:`, error);

      if (error instanceof AuthRequiredError || error?.status === 401) {
        // Auth error - queue locally
        console.log(`📦 [${saveId}] Auth error, queuing locally`);
        const queueId = await saveQueue.enqueue(invoice);
        
        const duration = performance.now() - startTime;
        this.recordSaveMetrics(duration, isAutoSave, true);

        this.showToast(
          'Session expired. Draft saved locally - login to sync.',
          'warning'
        );

        return {
          success: true,
          queueId,
          savedLocally: true,
          error: error.message,
        };
        
      } else if (error?.status >= 500) {
        // Server error - queue for retry
        console.log(`📦 [${saveId}] Server error, queuing for retry`);
        const queueId = await saveQueue.enqueue(invoice);
        
        const duration = performance.now() - startTime;
        this.recordSaveMetrics(duration, isAutoSave, true);

        this.showToast(
          'Server unavailable. Changes saved locally and will sync automatically.',
          'warning'
        );

        return {
          success: true,
          queueId,
          savedLocally: true,
          error: error.message,
        };
        
      } else {
        // Other error - don't queue
        this.showToast(
          `Save failed: ${error.message || 'Unknown error'}`,
          'error'
        );
        
        return {
          success: false,
          error: error.message,
        };
      }
    }
  }

  async load(invoiceId: string): Promise<InvoiceData | null> {
    try {
      if (!authStore.isAuthenticated) {
        // Check local queue first
        const queued = await saveQueue.getAll();
        const local = queued.find(item => item.invoiceId === invoiceId);
        
        if (local) {
          console.log(`📂 Loaded invoice ${invoiceId} from local queue`);
          return local.payload;
        }
        
        this.showToast('Login required to load invoice', 'warning');
        return null;
      }

      const invoice = await apiClient.get<InvoiceData>(`/api/v1/invoice/${invoiceId}`);
      this.currentInvoice = invoice;
      
      return invoice;
      
    } catch (error: any) {
      console.error('Failed to load invoice:', error);
      
      if (error instanceof AuthRequiredError) {
        this.showToast('Login required to load invoice', 'warning');
      } else {
        this.showToast(`Failed to load invoice: ${error.message}`, 'error');
      }
      
      return null;
    }
  }

  setCurrentInvoice(invoice: InvoiceData): void {
    this.currentInvoice = invoice;
    this.hasUnsavedChanges = false;
    this.activityTracker.reset();

    if (this.options.enableAutoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Mark current invoice as having unsaved changes
   */
  markAsChanged(): void {
    this.hasUnsavedChanges = true;
    this.activityTracker.recordEdit();

    if (this.options.enableAutoSave && this.currentInvoice) {
      this.triggerAutoSave();
    }
  }

  private async autoSave(): Promise<void> {
    if (!this.currentInvoice) return;
    
    console.log('🔄 Auto-saving invoice...');
    await this.save(this.currentInvoice, true);
  }

  triggerAutoSave(): void {
    if (this.options.enableAutoSave && this.currentInvoice) {
      this.activityTracker.recordActivity();
      this.debouncedAutoSave();

      // Adjust auto-save interval if adaptive mode is enabled
      if (this.options.adaptiveAutoSave) {
        this.adjustAutoSaveInterval();
      }
    }
  }

  private startAutoSave(): void {
    this.stopAutoSave();

    if (!this.options.enableAutoSave) return;

    const interval = this.options.adaptiveAutoSave
      ? this.activityTracker.getAdaptiveInterval()
      : this.options.autoSaveInterval!;

    this.autoSaveTimer = setInterval(() => {
      this.autoSave();
    }, interval);

    console.log(`⏱️ Auto-save enabled (every ${interval / 1000}s, adaptive: ${this.options.adaptiveAutoSave})`);
  }

  /**
   * Adjust auto-save interval based on user activity
   */
  private adjustAutoSaveInterval(): void {
    if (!this.options.adaptiveAutoSave) return;

    const newInterval = this.activityTracker.getAdaptiveInterval();
    const currentInterval = this.options.autoSaveInterval;

    if (newInterval !== currentInterval) {
      this.options.autoSaveInterval = newInterval;
      this.startAutoSave(); // Restart with new interval
      console.log(`⏱️ Adjusted auto-save interval to ${newInterval / 1000}s`);
    }
  }

  /**
   * Determine if auto-save should be skipped
   */
  private shouldSkipAutoSave(): boolean {
    if (!this.hasUnsavedChanges) {
      return true; // No changes to save
    }

    if (!this.activityTracker.isUserActive()) {
      return true; // User inactive, skip to save resources
    }

    return false;
  }

  /**
   * Record save performance metrics
   */
  private recordSaveMetrics(duration: number, isAutoSave: boolean, savedLocally: boolean): void {
    this.saveTimes.push(duration);
    if (this.saveTimes.length > 100) {
      this.saveTimes.shift(); // Keep last 100 measurements
    }

    this.performanceMetrics.averageSaveTime =
      this.saveTimes.reduce((a, b) => a + b, 0) / this.saveTimes.length;
    this.performanceMetrics.lastSaveTime = duration;

    if (isAutoSave) {
      this.performanceMetrics.autoSaveCount++;
    } else {
      this.performanceMetrics.manualSaveCount++;
    }
  }

  /**
   * Setup activity tracking for adaptive auto-save
   */
  private setupActivityTracking(): void {
    // Track various user activities
    const events = ['keydown', 'click', 'scroll', 'mousemove'];

    events.forEach(event => {
      document.addEventListener(event, () => {
        this.activityTracker.recordActivity();
      }, { passive: true });
    });
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('⏱️ Auto-save disabled');
    }
  }

  private async handleAuthLost(): Promise<void> {
    console.log('🔒 Authentication lost, switching to local-only mode');
    this.stopAutoSave();
    
    if (this.currentInvoice) {
      await saveQueue.enqueue(this.currentInvoice);
      this.showToast('Session ended. Changes will be saved locally.', 'warning');
    }
  }

  private async handleSessionExpired(): Promise<void> {
    console.log('⏰ Session expired');
    this.stopAutoSave();
    
    if (this.currentInvoice) {
      await saveQueue.enqueue(this.currentInvoice);
    }
  }

  async syncPendingChanges(): Promise<{ success: number; failed: number }> {
    if (!authStore.isAuthenticated) {
      this.showToast('Login required to sync changes', 'warning');
      return { success: 0, failed: 0 };
    }

    this.showToast('Syncing pending changes...', 'info');
    const result = await saveQueue.flush();
    
    if (result.success > 0) {
      this.showToast(
        `Successfully synced ${result.success} invoice${result.success !== 1 ? 's' : ''}`,
        'success'
      );
    }
    
    if (result.failed > 0) {
      this.showToast(
        `Failed to sync ${result.failed} invoice${result.failed !== 1 ? 's' : ''}`,
        'error'
      );
    }
    
    return result;
  }

  async getPendingChanges(): Promise<number> {
    const stats = await saveQueue.getStats();
    return stats.total;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics & { activity: any } {
    return {
      ...this.performanceMetrics,
      activity: this.activityTracker.getStats(),
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      autoSaveCount: 0,
      autoSaveSkipped: 0,
      manualSaveCount: 0,
      averageSaveTime: 0,
      lastSaveTime: 0,
    };
    this.saveTimes = [];
    this.activityTracker.reset();
  }

  destroy(): void {
    this.stopAutoSave();
    this.currentInvoice = null;
    this.hasUnsavedChanges = false;
  }
}

export const invoiceService = new InvoiceService();
export default invoiceService;