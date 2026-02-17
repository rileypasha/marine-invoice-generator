/**
 * Performance monitoring and profiling utilities
 */

interface PerformanceMetric {
  name: string
  startTime: number
  duration?: number
  metadata?: Record<string, any>
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map()
  private enabled: boolean = process.env.NODE_ENV === 'development'

  /**
   * Start timing an operation
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return

    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    })
  }

  /**
   * End timing an operation and log results
   */
  end(name: string): number | null {
    if (!this.enabled) return null

    const metric = this.metrics.get(name)
    if (!metric) {
      console.warn(`[Performance] No start time found for: ${name}`)
      return null
    }

    const duration = performance.now() - metric.startTime
    metric.duration = duration

    // Log slow operations (> 16ms = slower than 60fps)
    if (duration > 16) {
      console.warn(
        `[Performance] ${name} took ${duration.toFixed(2)}ms`,
        metric.metadata || ''
      )
    }

    this.metrics.delete(name)
    return duration
  }

  /**
   * Measure a function execution
   */
  async measure<T>(
    name: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) return fn()

    this.start(name, metadata)
    try {
      const result = await fn()
      this.end(name)
      return result
    } catch (error) {
      this.end(name)
      throw error
    }
  }

  /**
   * Mark a custom performance point
   */
  mark(name: string): void {
    if (!this.enabled) return
    performance.mark(name)
  }

  /**
   * Measure between two marks
   */
  measureBetweenMarks(measureName: string, startMark: string, endMark: string): void {
    if (!this.enabled) return

    try {
      performance.measure(measureName, startMark, endMark)
      const measure = performance.getEntriesByName(measureName)[0]
      if (measure && measure.duration > 16) {
        console.warn(`[Performance] ${measureName}: ${measure.duration.toFixed(2)}ms`)
      }
    } catch (error) {
      console.error(`[Performance] Failed to measure ${measureName}:`, error)
    }
  }

  /**
   * Get performance entries for analysis
   */
  getEntries(type?: string): PerformanceEntryList {
    return type ? performance.getEntriesByType(type) : performance.getEntries()
  }

  /**
   * Clear performance entries
   */
  clear(): void {
    performance.clearMarks()
    performance.clearMeasures()
    this.metrics.clear()
  }

  /**
   * Log all Web Vitals metrics
   */
  logWebVitals(): void {
    if (!this.enabled) return

    // Log navigation timing
    const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navTiming) {
      console.group('[Performance] Navigation Timing')
      console.log('DNS:', navTiming.domainLookupEnd - navTiming.domainLookupStart, 'ms')
      console.log('TCP:', navTiming.connectEnd - navTiming.connectStart, 'ms')
      console.log('Request:', navTiming.responseStart - navTiming.requestStart, 'ms')
      console.log('Response:', navTiming.responseEnd - navTiming.responseStart, 'ms')
      console.log('DOM Processing:', navTiming.domComplete - navTiming.domInteractive, 'ms')
      console.log('DOM Content Loaded:', navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart, 'ms')
      console.log('Total Load Time:', navTiming.loadEventEnd - navTiming.fetchStart, 'ms')
      console.groupEnd()
    }

    // Log resource timing
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const largeResources = resources.filter(r => r.transferSize > 100000) // > 100KB
    if (largeResources.length > 0) {
      console.group('[Performance] Large Resources (>100KB)')
      largeResources.forEach(r => {
        console.log(`${r.name}: ${(r.transferSize / 1024).toFixed(2)} KB, ${r.duration.toFixed(2)}ms`)
      })
      console.groupEnd()
    }
  }

  /**
   * Monitor long tasks (>50ms)
   */
  observeLongTasks(callback?: (entries: PerformanceEntryList) => void): PerformanceObserver | null {
    if (!this.enabled || !('PerformanceObserver' in window)) return null

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          console.warn(`[Performance] Long task detected: ${entry.duration.toFixed(2)}ms`)
        })
        if (callback) callback(entries)
      })

      observer.observe({ entryTypes: ['longtask'] })
      return observer
    } catch (error) {
      console.error('[Performance] Failed to observe long tasks:', error)
      return null
    }
  }

  /**
   * Get Core Web Vitals (requires web-vitals library)
   */
  async getCoreWebVitals(): Promise<void> {
    if (!this.enabled) return

    try {
      const { onCLS, onFID, onFCP, onLCP, onTTFB } = await import('web-vitals')

      onCLS((metric) => console.log('[Core Web Vitals] CLS:', metric.value))
      onFID((metric) => console.log('[Core Web Vitals] FID:', metric.value, 'ms'))
      onFCP((metric) => console.log('[Core Web Vitals] FCP:', metric.value, 'ms'))
      onLCP((metric) => console.log('[Core Web Vitals] LCP:', metric.value, 'ms'))
      onTTFB((metric) => console.log('[Core Web Vitals] TTFB:', metric.value, 'ms'))
    } catch (error) {
      console.warn('[Performance] web-vitals not available:', error)
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Convenience exports
export const { start, end, measure, mark, measureBetweenMarks, clear, logWebVitals } = performanceMonitor
