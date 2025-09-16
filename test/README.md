# Invoice Save Regression Testing Strategy

This document outlines the comprehensive testing strategy designed to prevent regression of the invoice save functionality, specifically addressing the critical issue where edit mode incorrectly shows rename dialogs instead of updating invoices in-place.

## 🚨 Critical Business Rules Tested

### 1. Edit Mode Behavior (CRITICAL)
- **Expected**: Edit existing invoice → Updates in-place (NO rename dialog)
- **Regression**: Edit mode showing rename dialog and creating duplicates
- **Test File**: `test/e2e/invoice-save-regression.spec.js`

### 2. Save-As-New Functionality
- **Expected**: Explicit "Save As New" → Shows rename dialog and creates duplicate
- **Test Coverage**: Preserve original + create new with different ID

### 3. Navigation Guards
- **Expected**: Warn about unsaved changes when navigating away
- **Test Coverage**: Modified vs unmodified invoice state detection

### 4. API Contract Compliance
- **Expected**: PUT/PATCH for updates, POST for creates
- **Test Coverage**: HTTP method validation, endpoint routing

## 📁 Test Structure

```
test/
├── e2e/
│   ├── invoice-save-regression.spec.js    # CRITICAL regression tests
│   └── change-tracking.spec.js            # Existing change tracking
├── unit/
│   └── invoice-save-logic.test.js         # Core logic unit tests
├── integration/
│   └── save-api-contract.test.js          # API contract validation
├── performance/
│   └── save-operations.spec.js            # Performance benchmarks
├── page-objects/
│   └── InvoicePage.js                     # Reusable page interactions
├── fixtures/
│   └── test-data.js                       # Test data and constants
└── README.md                              # This documentation
```

## 🔬 Test Categories

### Critical Regression Prevention
**Priority**: BLOCKING - Must pass before deployment

- ✅ Edit mode updates without rename dialog
- ✅ Invoice count stability during edits
- ✅ Edit mode state persistence across reloads
- ✅ API contract compliance (correct HTTP methods)
- ✅ Data persistence validation

### Performance Validation
**Priority**: HIGH - Performance requirements must be met

- Initial save: < 5 seconds
- Update save: < 3 seconds
- UI responsiveness: < 200ms
- Large invoices (50+ items): < 10 seconds
- Memory usage: < 100MB

### Integration Testing
**Priority**: MEDIUM - API contract validation

- Authentication enforcement
- Ownership validation
- Error handling
- Data structure consistency
- Server response validation

## 🚀 Running Tests

### Quick Regression Check
```bash
# Run critical tests only (fast feedback)
npm run test:critical

# Run specific regression tests
npm run test:e2e:regression
```

### Full Test Suite
```bash
# Complete test coverage
npm run test:full

# Individual test categories
npm run test:unit
npm run test:integration
npm run test:performance
```

### CI/CD Integration
```bash
# CI optimized (parallel, headless)
npm run e2e:regression:ci

# With trace collection on failure
npm run e2e:trace
```

### Development Testing
```bash
# Interactive test development
npm run test:e2e:ui

# Debug specific test
npm run e2e:debug
```

## 🔧 Test Configuration

### Environment Setup
```bash
# Database setup
npm run db:migrate

# Application build
npm run build && npm run build:css

# Server start (test mode)
npm run server:dev
```

### Test Data
- **Users**: Test users with different permissions
- **Invoices**: Minimal, standard, complex test cases
- **Scenarios**: Regression, performance, concurrent operations
- **Fixtures**: Consistent test data across suites

### Page Object Model
Centralized selectors and operations in `test/page-objects/InvoicePage.js`:
- Stable data-testid selectors
- Reusable interaction methods
- Common workflows (login, save, validate)

## 🎯 Key Test Scenarios

### Scenario 1: Edit Mode Validation (CRITICAL)
```javascript
test('Edit existing invoice updates in-place without rename dialog', async ({ page }) => {
  // 1. Create new invoice
  // 2. Verify edit mode is active
  // 3. Modify invoice data
  // 4. Save → Should NOT show rename dialog
  // 5. Verify data persistence
  // 6. Verify same invoice ID (no duplication)
});
```

### Scenario 2: Performance Under Load
```javascript
test('Large invoice save completes within time limits', async ({ page }) => {
  // 1. Create invoice with 50+ line items
  // 2. Measure save time < 10 seconds
  // 3. Measure update time < 3 seconds
  // 4. Verify UI responsiveness maintained
});
```

### Scenario 3: API Contract Validation
```javascript
test('HTTP methods match operation type', async ({ page }) => {
  // 1. Monitor network requests
  // 2. Create → Verify POST to /api/v2/invoice/save
  // 3. Update → Verify POST to /api/v3/invoices/smart-save
  // 4. No create endpoints called for updates
});
```

## 🛡️ Quality Gates

### Pre-Deployment Checks
1. **Critical Regression Tests**: 100% pass rate required
2. **Performance Benchmarks**: All operations within time limits
3. **API Contract**: Correct HTTP methods and endpoints
4. **Error Handling**: Graceful degradation tested

### Monitoring & Alerts
- **Failed Tests**: Block deployment, require investigation
- **Performance Degradation**: Alert if save times exceed thresholds
- **Memory Leaks**: Monitor memory usage patterns
- **Error Rates**: Track save operation success rates

## 🔍 Debugging Failed Tests

### Test Artifacts
- **Screenshots**: On failure, before/after states
- **Videos**: Full interaction recording
- **Traces**: Detailed execution timeline
- **Network Logs**: API request/response data
- **Console Logs**: Application state and errors

### Common Issues
1. **Timing Issues**: Use proper waits, not arbitrary delays
2. **Selector Changes**: Update data-testid selectors
3. **State Synchronization**: Ensure app state matches expectations
4. **Network Conditions**: Account for slow/failed requests

### Investigation Steps
1. Review test artifacts (screenshots, videos, traces)
2. Check console logs for JavaScript errors
3. Verify network requests match expected patterns
4. Validate application state at failure point
5. Reproduce locally with same test data

## 📊 Test Metrics & Reporting

### Success Criteria
- **Critical Tests**: 100% pass rate
- **Performance Tests**: All operations within SLA
- **Coverage**: >90% for save-related code paths
- **Reliability**: <5% flaky test rate

### Reporting
- **GitHub Actions**: Automatic test execution on code changes
- **Artifacts**: Test results, traces, screenshots preserved
- **Notifications**: Slack/email alerts on failures
- **Dashboards**: Performance trends and success rates

## 🔄 Maintenance

### Regular Updates
- **Test Data**: Refresh fixtures to match production patterns
- **Selectors**: Update data-testid attributes as UI evolves
- **Performance Baselines**: Adjust limits based on infrastructure
- **Scenarios**: Add tests for new features and reported issues

### Version Control
- **Test Changes**: Require review for critical test modifications
- **Baseline Updates**: Document performance limit changes
- **Test Data**: Version control fixtures and test scenarios

## 🚀 Future Enhancements

### Planned Improvements
1. **Visual Regression**: Screenshot comparison testing
2. **Accessibility**: WCAG compliance validation
3. **Cross-Browser**: Extended browser matrix testing
4. **Mobile**: Responsive design validation
5. **Load Testing**: Concurrent user simulation

### Integration Opportunities
1. **Monitoring**: Real-time production metrics
2. **Analytics**: User behavior pattern analysis
3. **Feedback**: User-reported issue correlation
4. **Performance**: Real User Monitoring (RUM) integration

---

## Quick Reference

### Critical Commands
```bash
npm run test:critical          # Must pass before deployment
npm run test:e2e:regression   # Focus on save regression
npm run quality:gate          # Complete quality validation
npm run deploy:check          # Pre-deployment verification
```

### Emergency Procedures
If critical tests fail:
1. **Stop deployment pipeline**
2. **Review test artifacts**
3. **Identify root cause**
4. **Fix and re-test**
5. **Document incident**

This testing strategy ensures the invoice save functionality remains reliable and prevents the specific regression where edit mode incorrectly shows rename dialogs instead of updating invoices in-place.