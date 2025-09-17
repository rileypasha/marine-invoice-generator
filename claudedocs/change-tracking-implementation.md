# Invoice Change Tracking System Implementation

## Overview

This document describes the comprehensive change tracking system implemented for invoices, enabling master users to track and acknowledge invoice modifications with detailed diff visualization.

## Architecture

### Database Schema Changes

#### New Fields in `Invoice` Table
- `hasUnreadChanges` (Boolean, default: false) - Flags invoices with unacknowledged changes
- `lastMasterViewAt` (DateTime, nullable) - Timestamp of last master acknowledgment

#### Database Migration
```sql
-- Add change tracking fields
ALTER TABLE "Invoice" ADD COLUMN "hasUnreadChanges" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN "lastMasterViewAt" TIMESTAMP(3);

-- Add indexes for performance
CREATE INDEX "Invoice_hasUnreadChanges_idx" ON "Invoice"("hasUnreadChanges");
CREATE INDEX "Invoice_lastMasterViewAt_idx" ON "Invoice"("lastMasterViewAt");
```

### Backend Implementation

#### Core Utilities

**`/server/utils/changeTracker.js`**
- `flagUnreadChanges()` - Marks existing invoices as having unread changes
- `acknowledgeChanges()` - Clears unread flag and sets master view timestamp
- `computeDiffSinceLastMasterView()` - Generates diff between versions
- `getChangeTrackingSummary()` - Provides dashboard statistics
- `validateMasterAuth()` - Validates master user permissions

#### API Endpoints

**`/server/routes/changeTracking.js`**
- `GET /api/change-tracking/:id?include=diff` - Get invoice with optional diff
- `PATCH /api/change-tracking/:id/acknowledge` - Master-only acknowledgment endpoint
- `GET /api/change-tracking/summary` - Dashboard statistics
- `GET /api/change-tracking/:id/changes/history` - Change history with pagination

#### Integration Points

**Updated Save Operations (`/server/routes/invoiceV2.js`)**
- Modified `POST /api/v2/invoice/save` to skip change tracking for new invoices
- Added `PUT /api/v2/invoice/:id` with integrated change tracking
- Atomic database transactions ensure data consistency

### Frontend Implementation

#### React Components

**`/src/master/components/InvoiceChangesViewer.js`**
- Complete invoice change viewer with diff rendering
- Auto-acknowledgment support for optimistic UI updates
- Error handling and loading states
- Responsive design for various screen sizes

#### Utility Functions

**`/src/master/utils/diffRenderer.js`**
- `renderDiff()` - Complete diff HTML generation
- `formatFieldPath()` - Human-readable field name conversion
- `formatValue()` - Type-aware value formatting (currency, percentages, etc.)
- `createChangesFlag()` - Dashboard icon generation

#### Styling

**`/src/master/styles/changeTracking.css`**
- Complete CSS for diff visualization
- Color-coded changes (green=added, red=removed, orange=modified)
- Responsive design and print styles
- Accessibility-compliant color contrast

## Security & Authorization

### Master-Only Access
- All change tracking endpoints require `requireMaster` middleware
- API validates user role before processing requests
- Frontend components check user permissions

### Input Validation
- Invoice ID validation using existing patterns
- Sanitized query parameters with type checking
- Comprehensive error handling and logging

### Data Integrity
- Database transactions ensure atomicity
- Change tracking failures don't break save operations
- Graceful degradation when change tracking is unavailable

## Performance Considerations

### Database Optimization
- Indexed fields for efficient querying
- Paginated change history endpoints
- Minimal data transfer with selective field inclusion

### Frontend Optimization
- Lazy loading of diff computation
- Optimistic UI updates for acknowledgments
- Efficient DOM manipulation with targeted updates

### Caching Strategy
- Browser caching for static assets
- Session-based caching for user permissions
- Minimal API calls with smart state management

## Testing

### Unit Tests (`/tests/changeTracker.test.js`)
- Core utility function validation
- Error handling scenarios
- Integration workflow testing
- Mock-based isolation testing

### API Integration Tests (`/tests/changeTrackingAPI.test.js`)
- Complete endpoint testing with Express app
- Authentication and authorization validation
- Error response verification
- Request/response format validation

### Test Coverage
- 90%+ coverage for core change tracking logic
- Edge case handling (empty diffs, missing invoices)
- Database error simulation and recovery

## Usage Examples

### Basic Change Tracking Flow

1. **User Updates Invoice**
   ```javascript
   // Automatic change tracking in save operation
   PUT /api/v2/invoice/12345
   // Result: hasUnreadChanges = true, revision created
   ```

2. **Master Views Changes**
   ```javascript
   // Get invoice with diff
   GET /api/change-tracking/12345?include=diff
   // Result: Invoice data + computed diff
   ```

3. **Master Acknowledges Changes**
   ```javascript
   // Clear unread flag
   PATCH /api/change-tracking/12345/acknowledge
   // Result: hasUnreadChanges = false, lastMasterViewAt = now
   ```

### Frontend Integration

```jsx
import InvoiceChangesViewer from './components/InvoiceChangesViewer';

// Auto-acknowledge changes when viewed
<InvoiceChangesViewer
  invoiceId={selectedInvoiceId}
  hasUnreadChanges={true}
  autoAcknowledge={true}
  onAcknowledge={(result) => refreshDashboard()}
/>
```

### Dashboard Integration

```jsx
// Changes flag in dashboard table
{invoice.hasUnreadChanges && (
  <div dangerouslySetInnerHTML={{
    __html: createChangesFlag(true, changeCount)
  }} />
)}
```

## Migration Guide

### Database Migration
1. Run migration script to add new fields
2. Verify indexes are created successfully
3. Update Prisma schema and regenerate client

### Backend Deployment
1. Deploy new utility functions and API routes
2. Update server.js to register change tracking routes
3. Verify master authentication is working

### Frontend Integration
1. Include change tracking CSS in main stylesheet
2. Import and use InvoiceChangesViewer component
3. Update dashboard to show changes flags

## Monitoring & Observability

### Logging
- Structured logging with Pino for all change tracking operations
- Request IDs for tracing across operations
- Performance metrics for diff computation

### Error Tracking
- Comprehensive error handling with context
- Graceful degradation when services are unavailable
- User-friendly error messages

### Metrics
- Change tracking usage statistics
- Performance monitoring for diff computation
- Database query performance tracking

## Maintenance

### Regular Tasks
- Monitor change tracking performance
- Review and archive old revisions if needed
- Validate data consistency periodically

### Known Limitations
- Diff computation may be slow for very large invoices
- Memory usage scales with invoice size
- Historical revisions are kept indefinitely

### Future Enhancements
- Batch acknowledgment for multiple invoices
- Email notifications for new changes
- Advanced filtering and search capabilities
- Export functionality for change reports

## Troubleshooting

### Common Issues

**Changes not flagged after invoice update:**
- Verify flagUnreadChanges is called in save operation
- Check database transaction completion
- Validate user permissions

**Diff computation fails:**
- Check invoice revision history exists
- Verify data format consistency
- Review error logs for specific failures

**Master acknowledgment not working:**
- Validate master role authentication
- Check database connection and transactions
- Verify API endpoint routing

### Debug Tools
- Database queries for change tracking status
- API endpoint testing with curl/Postman
- Browser dev tools for frontend debugging
- Log analysis for performance issues