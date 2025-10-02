# Testing Quick Reference

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific suite
npm run test:pwa
```

## 📋 Test Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `npm run test:all` | All test suites | Before PR, comprehensive check |
| `npm run test:pwa` | PWA installation & offline | PWA functionality verification |
| `npm run test:a11y` | Accessibility tests | WCAG 2.1 AA compliance |
| `npm run test:visual` | Visual regression | UI consistency check |
| `npm run test:lighthouse` | Lighthouse CI | Performance budgets |
| `npm run test:performance` | Performance benchmarks | FPS, latency, Web Vitals |
| `npm run test:offline` | Offline functionality | Cache and sync testing |
| `npm run test:mobile` | Mobile nav/UI | Mobile UX validation |
| `npm run test:ci` | CI test suite | GitHub Actions equivalent |

## 🔍 Debug Commands

```bash
# Interactive UI mode
npx playwright test --ui

# Run with browser visible
npx playwright test --headed

# Debug mode (step through)
npx playwright test --debug

# Specific test file
npx playwright test tests/pwa/mobile-nav.spec.ts

# View test trace
npx playwright show-trace trace.zip
```

## 📸 Visual Regression

```bash
# Update baselines (after intentional UI changes)
npm run test:visual:update

# Compare with baselines
npm run test:visual
```

## ✅ Pre-Commit Checklist

```bash
# 1. Lint code
npm run lint

# 2. Type check
npm run typecheck

# 3. Run unit tests
npm run test:unit

# 4. Run integration tests
npm run test:integration

# 5. Run PWA tests
npm run test:pwa

# 6. Run accessibility tests
npm run test:a11y
```

## 🎯 Acceptance Criteria

### Lighthouse Scores
- Performance: ≥90
- PWA: 100
- Accessibility: ≥95
- Best Practices: ≥90

### Performance Metrics
- LCP: <2.5s
- FID: <100ms
- CLS: <0.1
- TTI: <2.5s

### Mobile UX
- Touch targets: ≥44px
- Scroll FPS: ≥55
- Navigation: <300ms

## 📊 Test Coverage

| Category | Tests | Files |
|----------|-------|-------|
| PWA Installation | 17 | 1 |
| Offline Functionality | 15 | 1 |
| Mobile Navigation | 20+ | 1 |
| Mobile UI | 15+ | 1 |
| Performance | 25+ | 1 |
| Lighthouse | 5 | 1 |
| Visual Regression | 30+ | 1 |
| Accessibility | 25+ | 1 |
| Unit Tests | 15+ | 2 |
| Integration | 15+ | 1 |
| **Total** | **150+** | **14** |

## 🐛 Common Issues

### Service Worker Not Registering
```bash
# Clear cache and rebuild
rm -rf dist/
npm run build
npm start
```

### Visual Regression Failures
```bash
# Update baselines after intentional changes
npm run test:visual:update
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill
# Or use different port
PORT=3001 npm start
```

## 📁 File Locations

```
tests/
├── pwa/              # PWA E2E tests
├── lighthouse/       # Performance audits
├── visual/           # Screenshot comparisons
├── a11y/             # Accessibility tests
├── unit/pwa/         # PWA unit tests
├── integration/offline/  # Sync integration
└── utils/            # Test helpers
```

## 🔗 Resources

- **Full Guide**: `PWA_TESTING_GUIDE.md`
- **Summary**: `TDD_TESTING_SUITE_SUMMARY.md`
- **Config**: `playwright.config.ts`, `.lighthouserc.json`
- **CI**: `.github/workflows/pwa-tests.yml`
