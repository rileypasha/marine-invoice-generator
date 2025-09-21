# Feature Roadmap - Marine Invoice Generator

This document tracks planned features and enhancements that are currently marked with TODO comments in the codebase.

## Customer Management Features

### Customer CRUD Operations
- **File**: `src/js/customers.js`
- **Status**: Planned
- **Features**:
  - Edit customer modal/form (line 217)
  - Delete confirmation dialog (line 222)
  - Add new customer modal/form (line 227)
  - CSV import functionality (line 232)

**Implementation Notes**: These features should use Magic UI components (Dialog, AlertDialog, Form) for consistency with the modernized codebase.

## Vessel Management Features

### Vessel CRUD Operations
- **File**: `src/js/vessels.js`
- **Status**: Planned
- **Features**:
  - Edit vessel modal/form (line 160)
  - Toggle vessel status (active/inactive) (line 165)
  - Add new vessel modal/form (line 170)

**Implementation Notes**: Should integrate with existing React VesselsPageUI component and use Magic UI components.

## Invoice Management Features

### Invoice Actions
- **File**: `src/js/invoices.js`
- **Status**: Planned
- **Features**:
  - Navigate to invoice edit page (line 228)
  - Delete confirmation modal (line 234)
  - Navigate to invoice view page (line 242)
  - Print dialog or print view navigation (line 248)

**Implementation Notes**: Should use React Router for navigation and Magic UI AlertDialog for confirmations.

## Application Features

### Invoice Preview
- **File**: `src/js/app.js`
- **Status**: Planned
- **Feature**: Open preview modal or new tab (line 500)

**Implementation Notes**: Should use Magic UI Dialog for modal preview or browser window.open() for new tab.

## Development Priorities

### High Priority
1. **Customer CRUD Operations** - Essential for customer management workflow
2. **Vessel CRUD Operations** - Essential for vessel management workflow
3. **Invoice View/Edit Navigation** - Core invoice management functionality

### Medium Priority
1. **Delete Confirmations** - Important for data safety
2. **CSV Import** - Useful for bulk data operations

### Low Priority
1. **Invoice Preview Modal** - Enhancement to existing preview functionality
2. **Print Dialog** - Enhancement to existing print functionality

## Technical Implementation Guidelines

### UI Components
- Use Magic UI components for all dialogs and forms
- Maintain consistency with existing React implementations
- Follow the design patterns established in the modernized components

### State Management
- Integrate with existing state management patterns
- Ensure proper error handling and loading states
- Maintain data consistency across components

### API Integration
- Follow existing API patterns for CRUD operations
- Implement proper error handling and user feedback
- Ensure proper authentication and authorization

## Notes
- All TODO comments have been documented in this roadmap
- Original TODO comments remain in code for developer reference
- Implementation should follow the established React + Magic UI pattern
- Features should be implemented incrementally with proper testing