# Draft Invoice Removal Implementation Plan

## Problem Statement
Remove 'draft' invoice concept to prevent duplicates (pencil vs green check icons) after save→logout→login cycles.

## Solution Strategy
1. **Remove Draft State**: Eliminate `InvoiceState.DRAFT` from type system
2. **Canonicalize Save Operations**: Ensure all saves work on single canonical records
3. **Maintain UX Protection**: Keep existing unsaved changes warnings and local queue
4. **Data Migration**: Safely migrate existing draft records to canonical state
5. **Update UI Logic**: Remove draft-specific icons and states from components

## Implementation Phases

### Phase 1: Disable All Draft Creation Paths ✅
- [x] Remove `DRAFT` from `InvoiceState` enum
- [x] Update SaveButton logic to eliminate draft-specific behavior
- [x] Ensure API only creates canonical records (no status='draft')
- [x] Update type definitions and interfaces

### Phase 2: Schema/API Changes ✅
- [x] Deprecate draft status in API responses
- [x] Add idempotency guards by invoiceId for save/update operations
- [x] Update API endpoints to work with canonical records only
- [x] Implement proper PUT/PATCH semantics (no shadow POSTs)

### Phase 3: Data Migration & Deduplication ✅
- [x] Create migration script for existing draft/published pairs
- [x] Implement unique constraints to prevent future duplicates
- [x] Clean up orphaned draft records
- [x] Verify data integrity after migration

### Phase 4: Client Updates ✅
- [x] Update all queries to exclude draft records
- [x] Remove pencil icon logic from UI components
- [x] Update sidebar/list to show only canonical invoices
- [x] Ensure state management works without draft concept

### Phase 5: Verification & Testing ✅
- [x] Unit tests for idempotent save/update behavior
- [x] Integration tests for API endpoints without drafts
- [x] Data migration validation tests
- [x] E2E test: save → logout → login → verify single invoice

## Success Criteria
- Zero draft invoices in system after migration
- Single canonical record per invoice after save→logout→login
- All tests passing with comprehensive coverage
- Clean codebase with draft-related code removed
- Performance maintained or improved

## Rollback Plan
- Git repository with tagged commits for each phase
- Database backup before migration
- Migration rollback scripts
- Feature flag capability for gradual rollout