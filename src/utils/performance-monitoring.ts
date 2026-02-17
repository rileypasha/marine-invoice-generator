/**
 * Comprehensive Performance Monitoring Utility
 *
 * Tracks Web Vitals, Long Tasks, frame rates, and provides actionable insights
 * for mobile-first performance optimization.
 *
 * @module performance-monitoring
 */

export interface WebVitalsMetrics {
  /** Largest Contentful Paint - measures loading performance */
  lcp: number | null
  /** First Input Delay - measures interactivity */
  fid: number | null
  /** Cumulative Layout Shift - measures visual stability */
  cls: number | null
  /** First Contentful Paint - measures perceived load speed */
  fcp: number | null
  /** Time to First Byte - measures server response time */
  ttfb: number | null
  /** Time to Interactive - measures when page becomes fully interactive */
  tti: number | null
  /** Total Blocking Time - measures main thread blocking time */
  tbt: number | null
}

export interface PerformanceReport {
  /** Web Vitals scores */
  vitals: WebVitalsMetrics
  /** Number of long tasks detected (>50ms) */
  longTasksCount: number
  /** Average frame rate over monitoring period */
  averageFps: number
  /** Maximum JavaScript heap size (MB) */
  maxHeapSize: number | null
  /** Current JavaScript heap size (MB) */
  currentHeapSize: number | null
  /** Number of slow interactions detected */
  slowInteractionsCount: number
  /** Timestamp of report generation */
  timestamp: number
}

export interface LongTask {
  /** Duration in milliseconds */
  duration: number
  /** Start time relative to navigation */
  startTime: number
  /** Task name (if available) */
  name?: string
}

export interface PerformanceConfig {
  /** Enable console logging of metrics */
  enableLogging?: boolean
  /** Report metrics to analytics endpoint */
  reportToAnalytics?: boolean
  /** Analytics endpoint URL */
  analyticsEndpoint?: string
  /** Sampling rate (0-1) for analytics reporting */
  samplingRate?: number
  /** Threshold for long tasks in ms */
  longTaskThreshold?: number
  /** Threshold for slow interactions in ms */
  slowInteractionThreshold?: number
  /** Enable memory monitoring */
  enableMemoryMonitoring?: boolean
}

class PerformanceMonitor {
  private vitals: WebVitalsMetrics = {
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    tti: null,
    tbt: null,
  }

  private longTasks: LongTask[] = []
  private frameTimestamps: number[] = []
  private slowInteractions: number = 0
  private clsValue: number = 0
  private config: Required<PerformanceConfig>

  private observers: PerformanceObserver[] = []
  private rafId: number | null = null

  constructor(config: PerformanceConfig = {}) {
    this.config = {
      enableLogging: config.enableLogging ?? true,
      reportToAnalytics: config.reportToAnalytics ?? false,
      analyticsEndpoint: config.analyticsEndpoint ?? '/api/analytics/performance',
      samplingRate: config.samplingRate ?? 0.1, // 10% of users
      longTaskThreshold: config.longTaskThreshold ?? 50,
      slowInteractionThreshold: config.slowInteractionThreshold ?? 100,
      enableMemoryMonitoring: config.enableMemoryMonitoring ?? true,
    }

    this.init()
  }

  private init(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported')
      return
    }

    // Should this user be sampled for analytics?
    const shouldReport = Math.random() < this.config.samplingRate

    this.observeLCP()
    this.observeFID()
    this.observeCLS()
    this.observeFCP()
    this.observeTTFB()
    this.observeLongTasks()
    this.observeINP() // Interaction to Next Paint
    this.trackFrameRate()

    if (this.config.enableMemoryMonitoring) {
      this.monitorMemory()
    }

    // Report on page unload (if enabled and sampled)
    if (this.config.reportToAnalytics && shouldReport) {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.reportToAnalytics()
        }
      })
    }

    // Log report every 30 seconds in dev mode
    if (this.config.enableLogging && import.meta.env.DEV) {
      setInterval(() => {
        this.logReport()
      }, 30000)
    }
  }

  /**
   * Observe Largest Contentful Paint (LCP)
   * Target: < 2.5s (good), < 4.0s (needs improvement), >= 4.0s (poor)
   */
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as any
        if (!lastEntry) return
        this.vitals.lcp = lastEntry.renderTime || lastEntry.loadTime

        if (this.config.enableLogging && this.vitals.lcp !== null) {
          const lcpValue = this.vitals.lcp
          const rating = lcpValue < 2500 ? 'good' : lcpValue < 4000 ? 'warn' : 'bad'
          console.log(`${rating} LCP: ${lcpValue.toFixed(0)}ms`)
        }
      })

      observer.observe({ type: 'largest-contentful-paint', buffered: true })
      this.observers.push(observer)
    } catch (e) {
      console.warn('LCP observation failed:', e)
    }
  }

  /**
   * Observe First Input Delay (FID)
   * Target: < 100ms (good), < 300ms (needs improvement), >= 300ms (poor)
   */
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[]
        entries.forEach((entry) => {
          this.vitals.fid = entry.processingStart - entry.startTime

          if (this.config.enableLogging) {
            const rating = this.vitals.fid < 100 ? '✅' : this.vitals.fid < 300 ? '⚠️' : '❌'
            console.log(`${rating} FID: ${this.vitals.fid.toFixed(0)}ms`)
          }
        })
      })

      observer.observe({ type: 'first-input', buffered: true })
      this.observers.push(observer)
    } catch (e) {
      console.warn('FID observation failed:', e)
    }
  }

  /**
   * Observe Cumulative Layout Shift (CLS)
   * Target: < 0.1 (good), < 0.25 (needs improvement), >= 0.25 (poor)
   */
  private observeCLS(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[]
        entries.forEach((entry) => {
          // Only count layout shifts without recent user input
          if (!entry.hadRecentInput) {
            this.clsValue += entry.value
            this.vitals.cls = this.clsValue
          }
        })

        if (this.config.enableLogging && this.vitals.cls !== null) {
          const rating = this.vitals.cls < 0.1 ? '✅' : this.vitals.cls < 0.25 ? '⚠️' : '❌'
          console.log(`${rating} CLS: ${this.vitals.cls.toFixed(3)}`)
        }
      })

      observer.observe({ type: 'layout-shift', buffered: true })
      this.observers.push(observer)
    } catch (e) {
      console.warn('CLS observation failed:', e)
    }
  }

  /**
   * Observe First Contentful Paint (FCP)
   * Target: < 1.8s (good), < 3.0s (needs improvement), >= 3.0s (poor)
   */
  private observeFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.vitals.fcp = entry.startTime

            if (this.config.enableLogging) {
              const rating = this.vitals.fcp < 1800 ? '✅' : this.vitals.fcp < 3000 ? '⚠️' : '❌'
              console.log(`${rating} FCP: ${this.vitals.fcp.toFixed(0)}ms`)
            }
          }
        })
      })

      observer.observe({ type: 'paint', buffered: true })
      this.observers.push(observer)
    } catch (e) {
      console.warn('FCP observation failed:', e)
    }
  }

  /**
   * Observe Time to First Byte (TTFB)
   * Target: < 800ms (good), < 1800ms (needs improvement), >= 1800ms (poor)
   */
  private observeTTFB(): void {
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as any
      if (navigationEntry) {
        this.vitals.ttfb = navigationEntry.responseStart - navigationEntry.requestStart

        if (this.config.enableLogging) {
          const rating = this.vitals.ttfb < 800 ? '✅' : this.vitals.ttfb < 1800 ? '⚠️' : '❌'
          console.log(`${rating} TTFB: ${this.vitals.ttfb.toFixed(0)}ms`)
        }
      }
    } catch (e) {
      console.warn('TTFB observation failed:', e)
    }
  }

  /**
   * Observe Long Tasks (>50ms)
   * These block the main thread and hurt interactivity
   */
  private observeLongTasks(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[]
        entries.forEach((entry) => {
          if (entry.duration > this.config.longTaskThreshold) {
            this.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            })

            if (this.config.enableLogging) {
              console.warn(`⚠️ Long Task: ${entry.duration.toFixed(0)}ms at ${entry.startTime.toFixed(0)}ms`)
            }
          }
        })
      })

      observer.observe({ type: 'longtask', buffered: true })
      this.observers.push(observer)
    } catch (e) {
      // Long Tasks API not supported in all browsers
      console.debug('Long Tasks observation not supported')
    }
  }

  /**
   * Observe Interaction to Next Paint (INP)
   * Measures responsiveness of all user interactions
   */
  private observeINP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[]
        entries.forEach((entry) => {
          const interactionTime = entry.processingStart - entry.startTime + entry.duration

          if (interactionTime > this.config.slowInteractionThreshold) {
            this.slowInteractions++

            if (this.config.enableLogging) {
              console.warn(`⚠️ Slow Interaction: ${interactionTime.toFixed(0)}ms`)
            }
          }
        })
      })

      observer.observe({ type: 'event', buffered: true })
      this.observers.push(observer)
    } catch (e) {
      console.debug('INP observation not supported')
    }
  }

  /**
   * Track frame rate using requestAnimationFrame
   * Target: 60fps (16.67ms per frame)
   */
  private trackFrameRate(): void {
    let lastTime = performance.now()

    const measureFrame = (currentTime: number) => {
      const delta = currentTime - lastTime
      this.frameTimestamps.push(delta)

      // Keep only last 120 frames (2 seconds at 60fps)
      if (this.frameTimestamps.length > 120) {
        this.frameTimestamps.shift()
      }

      lastTime = currentTime
      this.rafId = requestAnimationFrame(measureFrame)
    }

    this.rafId = requestAnimationFrame(measureFrame)
  }

  /**
   * Monitor JavaScript heap memory usage
   */
  private monitorMemory(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory
        const heapSizeMB = memory.usedJSHeapSize / 1024 / 1024

        if (this.config.enableLogging && heapSizeMB > 50) {
          console.warn(`⚠️ High memory usage: ${heapSizeMB.toFixed(1)}MB`)
        }
      }, 10000) // Check every 10 seconds
    }
  }

  /**
   * Calculate average FPS from frame timestamps
   */
  private getAverageFPS(): number {
    if (this.frameTimestamps.length === 0) return 60

    const avgFrameTime = this.frameTimestamps.reduce((a, b) => a + b, 0) / this.frameTimestamps.length
    return Math.round(1000 / avgFrameTime)
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): { current: number | null; max: number | null } {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        current: memory.usedJSHeapSize / 1024 / 1024,
        max: memory.jsHeapSizeLimit / 1024 / 1024,
      }
    }
    return { current: null, max: null }
  }

  /**
   * Generate comprehensive performance report
   */
  public getReport(): PerformanceReport {
    const memory = this.getMemoryUsage()

    return {
      vitals: { ...this.vitals },
      longTasksCount: this.longTasks.length,
      averageFps: this.getAverageFPS(),
      maxHeapSize: memory.max,
      currentHeapSize: memory.current,
      slowInteractionsCount: this.slowInteractions,
      timestamp: Date.now(),
    }
  }

  /**
   * Log performance report to console
   */
  public logReport(): void {
    const report = this.getReport()

    console.group('📊 Performance Report')
    console.log('Web Vitals:')
    console.table({
      LCP: report.vitals.lcp ? `${report.vitals.lcp.toFixed(0)}ms` : 'N/A',
      FID: report.vitals.fid ? `${report.vitals.fid.toFixed(0)}ms` : 'N/A',
      CLS: report.vitals.cls ? report.vitals.cls.toFixed(3) : 'N/A',
      FCP: report.vitals.fcp ? `${report.vitals.fcp.toFixed(0)}ms` : 'N/A',
      TTFB: report.vitals.ttfb ? `${report.vitals.ttfb.toFixed(0)}ms` : 'N/A',
    })

    console.log(`Long Tasks: ${report.longTasksCount}`)
    console.log(`Average FPS: ${report.averageFps}`)
    console.log(`Slow Interactions: ${report.slowInteractionsCount}`)

    if (report.currentHeapSize) {
      console.log(`Memory: ${report.currentHeapSize.toFixed(1)}MB / ${report.maxHeapSize?.toFixed(1)}MB`)
    }

    console.groupEnd()
  }

  /**
   * Report metrics to analytics endpoint
   */
  private async reportToAnalytics(): Promise<void> {
    try {
      const report = this.getReport()

      // Use sendBeacon for reliability (works even when page is unloading)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(report)], { type: 'application/json' })
        navigator.sendBeacon(this.config.analyticsEndpoint, blob)
      } else {
        // Fallback to fetch with keepalive
        await fetch(this.config.analyticsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
          keepalive: true,
        })
      }
    } catch (error) {
      console.error('Failed to report analytics:', error)
    }
  }

  /**
   * Mark custom performance events
   */
  public mark(name: string): void {
    try {
      performance.mark(name)
      if (this.config.enableLogging) {
        console.log(`⏱️ Performance Mark: ${name}`)
      }
    } catch (e) {
      console.warn('Performance mark failed:', e)
    }
  }

  /**
   * Measure time between two marks
   */
  public measure(name: string, startMark: string, endMark: string): number | null {
    try {
      performance.measure(name, startMark, endMark)
      const measure = performance.getEntriesByName(name, 'measure')[0]

      if (this.config.enableLogging) {
        console.log(`⏱️ ${name}: ${measure.duration.toFixed(0)}ms`)
      }

      return measure.duration
    } catch (e) {
      console.warn('Performance measure failed:', e)
      return null
    }
  }

  /**
   * Clean up observers and timers
   */
  public destroy(): void {
    this.observers.forEach((observer) => observer.disconnect())
    this.observers = []

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

// Singleton instance
let monitor: PerformanceMonitor | null = null

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(config?: PerformanceConfig): PerformanceMonitor {
  if (!monitor) {
    monitor = new PerformanceMonitor(config)
  }
  return monitor
}

/**
 * Get the current performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor | null {
  return monitor
}

/**
 * Get current performance report
 */
export function getPerformanceReport(): PerformanceReport | null {
  return monitor?.getReport() ?? null
}

/**
 * Log current performance report
 */
export function logPerformanceReport(): void {
  monitor?.logReport()
}

/**
 * Mark a custom performance event
 */
export function markPerformance(name: string): void {
  monitor?.mark(name)
}

/**
 * Measure time between performance marks
 */
export function measurePerformance(name: string, startMark: string, endMark: string): number | null {
  return monitor?.measure(name, startMark, endMark) ?? null
}

/**
 * Cleanup performance monitoring
 */
export function destroyPerformanceMonitoring(): void {
  monitor?.destroy()
  monitor = null
}

