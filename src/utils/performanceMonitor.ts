/**
 * Performance monitoring utilities for client-side performance tracking
 */

import { TIMEOUTS_ENV } from '../config/constants';

export interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface PerformanceSnapshot {
  timestamp: number;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  navigation?: {
    loadEventEnd?: number;
    domContentLoadedEventEnd?: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
  };
  resources?: PerformanceResourceTiming[];
}

/**
 * Client-side performance monitor with memory management
 */
export class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private snapshots: PerformanceSnapshot[] = [];
  private observers: PerformanceObserver[] = [];
  private maxEntries = 1000;
  private maxSnapshots = 100;

  constructor() {
    this.setupPerformanceObservers();
    this.startPeriodicSnapshots();
  }

  /**
   * Start timing a performance operation
   */
  startTiming(name: string, metadata?: Record<string, any>): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordEntry({
        name,
        startTime,
        duration,
        metadata,
      });
    };
  }

  /**
   * Record a performance entry
   */
  recordEntry(entry: PerformanceEntry): void {
    this.entries.push(entry);

    // Limit memory usage by keeping only recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  /**
   * Get performance statistics for a named operation
   */
  getStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    percentile95: number;
    recent: PerformanceEntry[];
  } {
    const nameEntries = this.entries.filter(entry => entry.name === name);

    if (nameEntries.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        percentile95: 0,
        recent: [],
      };
    }

    const durations = nameEntries.map(entry => entry.duration).sort((a, b) => a - b);
    const recent = nameEntries.slice(-10); // Last 10 entries

    return {
      count: nameEntries.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      percentile95: durations[Math.floor(durations.length * 0.95)] || 0,
      recent,
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): Record<string, any> {
    const uniqueNames = [...new Set(this.entries.map(entry => entry.name))];
    const stats: Record<string, any> = {};

    uniqueNames.forEach(name => {
      stats[name] = this.getStats(name);
    });

    return stats;
  }

  /**
   * Take a performance snapshot
   */
  takeSnapshot(): PerformanceSnapshot {
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
    };

    // Memory information (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      snapshot.memory = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }

    // Navigation timing
    if (performance.timing) {
      const timing = performance.timing;
      snapshot.navigation = {
        loadEventEnd: timing.loadEventEnd - timing.navigationStart,
        domContentLoadedEventEnd: timing.domContentLoadedEventEnd - timing.navigationStart,
      };
    }

    // Paint metrics
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach(entry => {
      if (entry.name === 'first-contentful-paint') {
        snapshot.navigation = {
          ...snapshot.navigation,
          firstContentfulPaint: entry.startTime,
        };
      }
    });

    // LCP (if available)
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      const latestLCP = lcpEntries[lcpEntries.length - 1] as any;
      snapshot.navigation = {
        ...snapshot.navigation,
        largestContentfulPaint: latestLCP.startTime,
      };
    }

    // Resource timing
    snapshot.resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    this.snapshots.push(snapshot);

    // Limit memory usage
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
    }

    return snapshot;
  }

  /**
   * Get recent performance snapshots
   */
  getSnapshots(limit: number = 10): PerformanceSnapshot[] {
    return this.snapshots.slice(-limit);
  }

  /**
   * Setup performance observers for automatic tracking
   */
  private setupPerformanceObservers(): void {
    try {
      // Long task observer
      if ('PerformanceObserver' in window) {
        const longTaskObserver = new PerformanceObserver((entryList) => {
          entryList.getEntries().forEach((entry) => {
            this.recordEntry({
              name: 'long-task',
              startTime: entry.startTime,
              duration: entry.duration,
              metadata: { type: entry.entryType },
            });
          });
        });

        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);

        // Layout shift observer
        const layoutShiftObserver = new PerformanceObserver((entryList) => {
          entryList.getEntries().forEach((entry: any) => {
            this.recordEntry({
              name: 'layout-shift',
              startTime: entry.startTime,
              duration: 0,
              metadata: {
                value: entry.value,
                hadRecentInput: entry.hadRecentInput,
              },
            });
          });
        });

        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);

        // LCP observer
        const lcpObserver = new PerformanceObserver((entryList) => {
          entryList.getEntries().forEach((entry) => {
            this.recordEntry({
              name: 'largest-contentful-paint',
              startTime: entry.startTime,
              duration: 0,
              metadata: {
                size: (entry as any).size,
                element: (entry as any).element?.tagName,
              },
            });
          });
        });

        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      }
    } catch (error) {
      console.warn('Performance observers not fully supported:', error);
    }
  }

  /**
   * Start periodic performance snapshots
   */
  private startPeriodicSnapshots(): void {
    // Take snapshot every 30 seconds
    setInterval(() => {
      this.takeSnapshot();
    }, 30000);

    // Initial snapshot
    setTimeout(() => {
      this.takeSnapshot();
    }, 1000);
  }

  /**
   * Get Core Web Vitals metrics
   */
  getCoreWebVitals(): {
    LCP?: number;
    FID?: number;
    CLS?: number;
  } {
    const vitals: any = {};

    // LCP
    const lcpEntries = this.entries.filter(entry => entry.name === 'largest-contentful-paint');
    if (lcpEntries.length > 0) {
      vitals.LCP = lcpEntries[lcpEntries.length - 1].startTime;
    }

    // CLS
    const clsEntries = this.entries.filter(entry => entry.name === 'layout-shift');
    if (clsEntries.length > 0) {
      vitals.CLS = clsEntries
        .filter(entry => !entry.metadata?.hadRecentInput)
        .reduce((sum, entry) => sum + (entry.metadata?.value || 0), 0);
    }

    // FID (First Input Delay) - would need additional instrumentation

    return vitals;
  }

  /**
   * Export performance data for analysis
   */
  exportData(): {
    entries: PerformanceEntry[];
    snapshots: PerformanceSnapshot[];
    stats: Record<string, any>;
    vitals: any;
  } {
    return {
      entries: this.entries,
      snapshots: this.snapshots,
      stats: this.getAllStats(),
      vitals: this.getCoreWebVitals(),
    };
  }

  /**
   * Clear all performance data
   */
  clear(): void {
    this.entries = [];
    this.snapshots = [];
  }

  /**
   * Cleanup observers and timers
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.clear();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for automatic performance timing
 */
export function measurePerformance(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const endTiming = performanceMonitor.startTiming(methodName, {
        args: args.length,
        className: target.constructor.name,
        methodName: propertyKey,
      });

      try {
        const result = await originalMethod.apply(this, args);
        endTiming();
        return result;
      } catch (error) {
        endTiming();
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Performance timing utility function
 */
export async function withPerformanceTiming<T>(
  name: string,
  operation: () => Promise<T> | T,
  metadata?: Record<string, any>
): Promise<T> {
  const endTiming = performanceMonitor.startTiming(name, metadata);

  try {
    const result = await operation();
    endTiming();
    return result;
  } catch (error) {
    endTiming();
    throw error;
  }
}

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceMonitor.destroy();
  });
}
