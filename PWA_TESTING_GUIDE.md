# PWA Testing Guide

Comprehensive testing suite for the Marine Invoice PWA application with mobile-first design, offline support, and performance optimization.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)
- [Writing New Tests](#writing-new-tests)

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm run test:all
```

### Run Specific Test Suites

```bash
npm run test:pwa           # PWA installation and offline tests
npm run test:a11y          # Accessibility tests
npm run test:visual        # Visual regression tests
npm run test:lighthouse    # Lighthouse performance audits
npm run test:mobile        # Mobile navigation and UI tests
npm run test:performance   # Performance benchmarks
npm run test:offline       # Offline functionality tests
```

## Test Structure

```
tests/
├── pwa/                      # PWA-specific tests
│   ├── pwa-install.spec.ts   # Installation, service worker, manifest
│   ├── offline.spec.ts       # Offline functionality and sync
│   ├── mobile-nav.spec.ts    # Bottom navigation, FAB, touch targets
│   ├── mobile-ui.spec.ts     # Cards, gestures, detail sheets
│   └── performance.spec.ts   # FPS, latency, Core Web Vitals
│
├── lighthouse/               # Lighthouse CI tests
│   └── lighthouse.spec.ts    # Performance, PWA, SEO audits
│
├── visual/                   # Visual regression tests
│   └── visual-regression.spec.ts  # Screenshot comparisons
│
├── a11y/                     # Accessibility tests
│   └── accessibility.spec.ts # WCAG 2.1 AA compliance
│
├── unit/pwa/                 # PWA utility unit tests
│   ├── pwa-detection.test.ts # isPWA, isIOS, network status
│   └── offline-storage.test.ts # IndexedDB CRUD operations
│
├── integration/offline/      # Offline sync integration tests
│   └── sync-flow.test.ts     # Offline → online sync flow
│
└── utils/                    # Test utilities and helpers
    ├── mobile-helpers.ts     # Mobile testing utilities
    └── pwa-helpers.ts        # PWA testing utilities
```

## Running Tests

### Development Workflow

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Run tests in watch mode:**
   ```bash
   npx playwright test --ui
   ```

3. **Run specific test file:**
   ```bash
   npx playwright test tests/pwa/mobile-nav.spec.ts
   ```

### CI/CD Workflow

Tests run automatically on:
- Pull requests to `main` or `develop`
- Pushes to `main`, `develop`, or `react-tw3-vite` branches

```bash
npm run test:ci
```

## Test Coverage

### PWA Installation Tests (`pwa-install.spec.ts`)

**Coverage:**
- ✅ Valid PWA manifest with all required fields
- ✅ PWA icons (192x192, 512x512, maskable)
- ✅ Service worker registration and activation
- ✅ `beforeinstallprompt` event handling
- ✅ Standalone display mode detection
- ✅ iOS-specific meta tags and splash screens
- ✅ PWA shortcuts and categories

**Acceptance Criteria:**
- PWA score: 100 (Lighthouse)
- All manifest fields present
- Service worker registered successfully
- Installable on all platforms

### Offline Functionality Tests (`offline.spec.ts`)

**Coverage:**
- ✅ App loads from cache while offline
- ✅ Offline banner appears when disconnected
- ✅ Navigate between cached pages offline
- ✅ Create/edit requests queued while offline
- ✅ Sync pending changes on reconnect
- ✅ No blank screens or errors offline
- ✅ API responses cached for offline use

**Acceptance Criteria:**
- App loads offline from cache
- Cached requests visible
- Offline banner shown
- Actions queued successfully
- Syncs on reconnect without data loss

### Mobile Navigation Tests (`mobile-nav.spec.ts`)

**Coverage:**
- ✅ Bottom nav appears on mobile (<768px)
- ✅ Bottom nav hidden on desktop (≥768px)
- ✅ Active tab highlighted correctly
- ✅ All touch targets ≥44x44px
- ✅ Smooth transitions between tabs
- ✅ FAB visible and functional
- ✅ Sidebar hidden on mobile PWA

**Acceptance Criteria:**
- Bottom nav in PWA mode
- Touch targets ≥44px
- Smooth transitions <300ms
- Sticky positioning while scrolling

### Mobile UI Tests (`mobile-ui.spec.ts`)

**Coverage:**
- ✅ Requests display as cards on mobile
- ✅ Cards show essential fields
- ✅ Pull-to-refresh gesture works
- ✅ Swipe actions functional
- ✅ Detail sheets open/close smoothly
- ✅ Safe area insets respected (iPhone notch)
- ✅ Images lazy load appropriately

**Acceptance Criteria:**
- Card layout on mobile
- Touch targets ≥44px
- Gestures work smoothly
- Safe area respected

### Performance Tests (`performance.spec.ts`)

**Coverage:**
- ✅ List scroll ≥55 FPS (no jank)
- ✅ Filter input latency <50ms
- ✅ Route transition <300ms
- ✅ Image lazy loading functional
- ✅ Layout shift (CLS) <0.1
- ✅ Memory usage stable
- ✅ Core Web Vitals (LCP, FID, CLS, TTFB)

**Acceptance Criteria:**
- TTI: <2.5s
- LCP: <2.5s
- FID: <100ms
- CLS: <0.1
- TBT: <300ms

### Lighthouse Tests (`.lighthouserc.json`)

**Performance Budgets:**
- Performance: ≥90
- PWA: 100
- Accessibility: ≥95
- Best Practices: ≥90
- SEO: ≥90

**Metrics:**
- First Contentful Paint: <2s
- Largest Contentful Paint: <2.5s
- Cumulative Layout Shift: <0.1
- Total Blocking Time: <300ms
- Speed Index: <3s
- Time to Interactive: <3s

### Visual Regression Tests (`visual-regression.spec.ts`)

**Viewports Tested:**
- iPhone SE (375x667)
- iPhone 14 (390x844)
- Pixel 5 (393x851)
- iPad Mini (768x1024)

**Scenarios:**
- Requests list (card layout)
- Request detail sheet
- Bottom navigation
- Offline banner
- Install prompt
- Loading skeletons
- Dark mode

**Acceptance Criteria:**
- No visual regressions on 4 viewports
- Consistent spacing/alignment
- Safe area insets respected

### Accessibility Tests (`accessibility.spec.ts`)

**Coverage:**
- ✅ WCAG 2.1 AA compliance (automated)
- ✅ Touch targets ≥44x44px
- ✅ Color contrast ≥4.5:1
- ✅ Focus indicators visible
- ✅ Screen reader navigation
- ✅ Keyboard navigation works
- ✅ Proper heading hierarchy
- ✅ Form labels present
- ✅ Zoom to 200% supported

**Acceptance Criteria:**
- Zero axe violations
- All interactive elements ≥44px
- Contrast ratios meet WCAG 2.1 AA
- Full keyboard navigation support

## CI/CD Integration

### GitHub Actions Workflow

Location: `.github/workflows/pwa-tests.yml`

**Jobs:**
1. **Unit Tests** - Jest unit tests with coverage
2. **Integration Tests** - Integration test suite
3. **PWA Tests** - Installation, offline, mobile
4. **Accessibility Tests** - WCAG 2.1 AA compliance
5. **Lighthouse Tests** - Performance budgets
6. **Visual Regression** - Screenshot comparisons
7. **Performance Budgets** - Bundle size checks
8. **Offline Tests** - Offline functionality
9. **Mobile Tests** - Mobile navigation/UI

**Artifacts:**
- Test reports (HTML, JSON, JUnit)
- Lighthouse reports
- Visual regression diffs
- Coverage reports

**Performance Gates:**
- Lighthouse scores must meet budgets
- Bundle size <500KB
- All tests must pass

### Running CI Locally

```bash
# Install dependencies
npm ci

# Run full CI suite
npm run test:ci

# Lint and typecheck
npm run lint
npm run typecheck
```

## Writing New Tests

### Test Utilities

Import helpers for mobile and PWA testing:

```typescript
import { setViewport, measureFPS, checkTouchTargetSize } from '../utils/mobile-helpers';
import { installPWA, checkServiceWorker, getCachedURLs } from '../utils/pwa-helpers';
```

### Example: PWA Test

```typescript
import { test, expect } from '@playwright/test';
import { checkServiceWorker, waitForServiceWorkerActivation } from '../utils/pwa-helpers';

test('should register service worker', async ({ page }) => {
  await page.goto('/');

  const swActivated = await waitForServiceWorkerActivation(page);
  expect(swActivated).toBe(true);

  const swStatus = await checkServiceWorker(page);
  expect(swStatus.registered).toBe(true);
  expect(swStatus.active).toBe(true);
});
```

### Example: Mobile Test

```typescript
import { test, expect } from '@playwright/test';
import { setViewport, checkTouchTargetSize } from '../utils/mobile-helpers';

test('bottom nav should have adequate touch targets', async ({ page }) => {
  await setViewport(page, 'iPhone14');
  await page.goto('/');

  const navItems = page.locator('[data-testid="bottom-nav"] a');
  const count = await navItems.count();

  for (let i = 0; i < count; i++) {
    const item = navItems.nth(i);
    const box = await item.boundingBox();

    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
```

### Example: Accessibility Test

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('page should pass axe accessibility audit', async ({ page }) => {
  await page.goto('/');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

### Example: Performance Test

```typescript
import { test, expect } from '@playwright/test';
import { measureFPS } from '../utils/mobile-helpers';

test('should scroll smoothly at ≥55 FPS', async ({ page }) => {
  await page.goto('/requests');

  const fps = await measureFPS(page, async () => {
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(1000);
  });

  expect(fps).toBeGreaterThanOrEqual(55);
});
```

## Debugging Tests

### Visual Debugging

```bash
# Open Playwright UI
npx playwright test --ui

# Run with browser visible
npx playwright test --headed

# Slow down execution
npx playwright test --slow-mo=1000
```

### Debug Mode

```bash
# Run in debug mode
npx playwright test --debug

# Debug specific test
npx playwright test tests/pwa/mobile-nav.spec.ts --debug
```

### Trace Viewer

```bash
# Generate trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## Best Practices

### Test Organization

- ✅ Group related tests in `describe` blocks
- ✅ Use descriptive test names
- ✅ Keep tests independent
- ✅ Clean up after tests (close dialogs, reset state)

### Assertions

- ✅ Use specific matchers (`toHaveText`, `toBeVisible`)
- ✅ Add timeout for async assertions
- ✅ Provide clear error messages

### Selectors

- ✅ Prefer `data-testid` for test stability
- ✅ Use semantic selectors (`role`, `label`)
- ✅ Avoid brittle selectors (class names, indexes)

### Performance

- ✅ Run tests in parallel when possible
- ✅ Use `test.beforeEach` for setup
- ✅ Minimize page loads and navigation

## Troubleshooting

### Common Issues

**Service Worker Not Registering:**
- Ensure app is running in production mode
- Check HTTPS or localhost
- Clear browser cache

**Visual Regression Failures:**
- Update baselines: `npm run test:visual:update`
- Check for animation timing issues
- Verify font loading

**Lighthouse Failures:**
- Check network throttling settings
- Ensure production build
- Review performance budgets

**Accessibility Violations:**
- Run axe DevTools manually
- Check color contrast
- Verify ARIA attributes

### Getting Help

- Review test output in `playwright-report/`
- Check CI logs in GitHub Actions
- Examine screenshots in `test-results/`
- Use `--debug` mode for step-through debugging

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [axe Accessibility Testing](https://www.deque.com/axe/)
- [Web Vitals](https://web.dev/vitals/)
- [PWA Checklist](https://web.dev/pwa-checklist/)
