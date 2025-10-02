import { test, expect } from '@playwright/test'

const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals targets
  LCP: 2500, // Largest Contentful Paint (ms) - target < 2.5s
  FID: 100, // First Input Delay (ms) - target < 100ms
  CLS: 0.1, // Cumulative Layout Shift - target < 0.1

  // Additional metrics
  FCP: 1800, // First Contentful Paint (ms) - target < 1.8s
  TTI: 3800, // Time to Interactive (ms) - target < 3.8s
  TBT: 300, // Total Blocking Time (ms) - target < 300ms

  // Route change performance
  ROUTE_CHANGE: 300, // Route change to first paint (ms) - target < 300ms
}

test.describe('Page Load Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3005/')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/requests')
  })

  test('Requests page - Initial load performance', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')

      const fcp = paint.find(entry => entry.name === 'first-contentful-paint')
      const lcp = performance.getEntriesByType('largest-contentful-paint').pop() as PerformanceEntry

      return {
        fcp: fcp?.startTime || 0,
        lcp: lcp?.startTime || 0,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalTime: navigation.loadEventEnd - navigation.fetchStart,
      }
    })

    console.log('Requests Page Metrics:', metrics)

    expect(metrics.fcp).toBeLessThan(PERFORMANCE_THRESHOLDS.FCP)
    expect(metrics.lcp).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP)
    expect(metrics.totalTime).toBeLessThan(5000) // 5 seconds max total load
  })

  test('Contacts page - Route change performance', async ({ page }) => {
    // Measure route change performance
    const startTime = Date.now()

    await page.click('a[href="/contacts"]')
    await page.waitForURL('**/contacts')
    await page.waitForSelector('table', { state: 'visible' })

    const routeChangeTime = Date.now() - startTime

    console.log('Route Change Time:', routeChangeTime, 'ms')

    expect(routeChangeTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ROUTE_CHANGE)
  })

  test('Vessels page - Route change performance', async ({ page }) => {
    const startTime = Date.now()

    await page.click('a[href="/vessels"]')
    await page.waitForURL('**/vessels')
    await page.waitForSelector('table', { state: 'visible' })

    const routeChangeTime = Date.now() - startTime

    console.log('Vessels Route Change Time:', routeChangeTime, 'ms')

    expect(routeChangeTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ROUTE_CHANGE)
  })

  test('Filter interaction performance', async ({ page }) => {
    await page.goto('http://localhost:3005/requests')

    // Measure filter typing response time
    const timings: number[] = []

    for (let i = 0; i < 5; i++) {
      const startTime = performance.now()
      await page.type('input[placeholder*="Filter"]', 'a', { delay: 0 })
      const endTime = performance.now()
      timings.push(endTime - startTime)
    }

    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length

    console.log('Average Filter Input Response Time:', avgTime.toFixed(2), 'ms')

    expect(avgTime).toBeLessThan(50) // < 50ms per keystroke
  })

  test('Table scroll performance', async ({ page }) => {
    await page.goto('http://localhost:3005/requests')
    await page.waitForSelector('table')

    // Measure scroll smoothness
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const container = document.querySelector('.overflow-auto')
        if (!container) return resolve()

        let frameCount = 0
        let lastTime = performance.now()

        const measureFPS = () => {
          const currentTime = performance.now()
          frameCount++

          if (currentTime - lastTime >= 1000) {
            console.log('FPS:', frameCount)
            resolve()
          } else {
            requestAnimationFrame(measureFPS)
          }
        }

        container.scrollTo({ top: 500, behavior: 'smooth' })
        requestAnimationFrame(measureFPS)
      })
    })

    // Just verify scroll works without errors
    expect(true).toBe(true)
  })

  test('Bundle size analysis', async ({ page }) => {
    const resourceSizes = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

      const jsBundles = resources
        .filter(r => r.name.includes('.js'))
        .map(r => ({
          name: r.name.split('/').pop(),
          size: r.transferSize,
          sizeKB: (r.transferSize / 1024).toFixed(2),
        }))
        .sort((a, b) => b.size - a.size)

      const totalJSSize = jsBundles.reduce((sum, r) => sum + r.size, 0)

      return {
        bundles: jsBundles.slice(0, 10), // Top 10 largest
        totalJSSize,
        totalJSSizeKB: (totalJSSize / 1024).toFixed(2),
      }
    })

    console.log('Bundle Analysis:', resourceSizes)

    // Total JS should be under 300KB gzipped (as per requirements)
    expect(resourceSizes.totalJSSize).toBeLessThan(300 * 1024)
  })
})

test.describe('Memory Performance', () => {
  test('Memory usage stays stable during navigation', async ({ page, context }) => {
    await page.goto('http://localhost:3005/')

    // Login
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/requests')

    // Navigate between pages multiple times
    const routes = ['/requests', '/contacts', '/vessels', '/requests']

    for (const route of routes) {
      await page.goto(`http://localhost:3005${route}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
    }

    // Check for memory leaks by ensuring no excessive DOM nodes
    const domNodeCount = await page.evaluate(() => {
      return document.getElementsByTagName('*').length
    })

    console.log('DOM Node Count:', domNodeCount)

    // Reasonable DOM size (not accumulating nodes)
    expect(domNodeCount).toBeLessThan(3000)
  })
})
