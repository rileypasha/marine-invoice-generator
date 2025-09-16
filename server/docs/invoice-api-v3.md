# Invoice API v3 - HTTP Semantics Documentation

## Overview

The Invoice API v3 implements proper REST HTTP semantics with clear separation between create and update operations. This ensures predictable behavior and prevents accidental data conflicts.

## Base URL

```
/api/v3/invoices
```

## Authentication

All endpoints require authentication via session or test user cookies.

## HTTP Methods and Semantics

### POST /api/v3/invoices (Create New Invoice)

**Purpose**: Create a new invoice resource

**HTTP Status**:
- `201 Created` - Invoice successfully created
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Authentication required

**Request Body**: Complete invoice data (ID will be generated)

```json
{
  "title": "New Invoice",
  "data": {
    "customer": {
      "customerName": "Customer Name",
      "customerEmail": "customer@example.com"
    },
    "scope": {
      "lineItems": [],
      "markupRate": 0.2,
      "isTaxable": true
    }
  },
  "metadata": {}
}
```

**Response**:
```json
{
  "success": true,
  "invoice": {
    "id": "generated-uuid",
    "title": "New Invoice",
    "state": "DRAFT",
    "version": 1,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

**Idempotency**: Supported via `Idempotency-Key` header

---

### PUT /api/v3/invoices/:id (Full Update)

**Purpose**: Replace entire invoice resource

**HTTP Status**:
- `200 OK` - Invoice successfully updated
- `404 Not Found` - Invoice does not exist
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Authentication required

**Request Body**: Complete invoice data (replaces existing)

```json
{
  "title": "Updated Invoice",
  "data": {
    "customer": {
      "customerName": "Updated Customer Name"
    },
    "scope": {
      "lineItems": [
        {
          "description": "Updated item",
          "quantity": 2,
          "cost": 150
        }
      ]
    }
  },
  "metadata": {
    "updatedReason": "Customer requested changes"
  }
}
```

**Response**:
```json
{
  "success": true,
  "invoice": {
    "id": "existing-uuid",
    "title": "Updated Invoice",
    "state": "MODIFIED",
    "version": 2,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:30:00Z"
  },
  "action": "UPDATED"
}
```

**Key Behaviors**:
- Preserves `id`, `createdAt`, `userId`, `userEmail`
- Increments `version` number
- Updates `updatedAt` timestamp
- Changes state to `MODIFIED`

---

### PATCH /api/v3/invoices/:id (Partial Update)

**Purpose**: Update only specified fields, merge with existing data

**HTTP Status**:
- `200 OK` - Invoice successfully patched
- `404 Not Found` - Invoice does not exist
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Authentication required

**Request Body**: Only fields to update

```json
{
  "title": "Partially Updated Title",
  "data": {
    "customer": {
      "customerPhone": "+1234567890"
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "invoice": {
    "id": "existing-uuid",
    "title": "Partially Updated Title",
    "data": {
      "customer": {
        "customerName": "Original Customer Name",
        "customerEmail": "original@example.com",
        "customerPhone": "+1234567890"
      },
      "scope": {
        "lineItems": []
      }
    },
    "state": "MODIFIED",
    "version": 2
  },
  "action": "PATCHED",
  "patchedFields": ["title", "data"]
}
```

**Key Behaviors**:
- Merges `data` objects recursively
- Preserves unspecified fields
- Recalculates totals if financial data changes
- Increments version and updates timestamps

---

### GET /api/v3/invoices/:id (Retrieve)

**Purpose**: Get specific invoice

**HTTP Status**:
- `200 OK` - Invoice found
- `404 Not Found` - Invoice does not exist
- `401 Unauthorized` - Authentication required

**Response**:
```json
{
  "success": true,
  "invoice": {
    "id": "uuid",
    "title": "Invoice Title",
    "state": "SAVED",
    "version": 1,
    "data": {},
    "metadata": {},
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

---

### GET /api/v3/invoices (List)

**Purpose**: List invoices for authenticated user

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `state` - Filter by state (DRAFT, SAVED, MODIFIED, FINALIZED)
- `search` - Search in title, customer, vessel name
- `orderBy` - Sort field (default: updatedAt)
- `orderDir` - Sort direction (asc/desc, default: desc)

**HTTP Status**:
- `200 OK` - List retrieved
- `401 Unauthorized` - Authentication required

---

### DELETE /api/v3/invoices/:id (Delete)

**Purpose**: Delete invoice

**HTTP Status**:
- `200 OK` - Invoice deleted
- `404 Not Found` - Invoice does not exist
- `401 Unauthorized` - Authentication required

---

### POST /api/v3/invoices/smart-save (Smart Save)

**Purpose**: Intelligently create or update based on presence of ID

**HTTP Status**:
- `200 OK` - Operation completed (create or update)
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Authentication required

**Request Body**: Invoice data with optional ID

**Response**:
```json
{
  "success": true,
  "invoice": {},
  "action": "CREATED|UPDATED"
}
```

**Logic**:
- If `id` present in body: Update existing invoice
- If no `id` present: Create new invoice
- Returns appropriate action type

---

## Invoice State Management

### States
- `DRAFT` - New invoice being created
- `SAVED` - Invoice persisted to storage
- `MODIFIED` - Saved invoice with unsaved changes
- `FINALIZED` - Complete invoice, no further edits allowed

### State Transitions
- `DRAFT` → `SAVED` (first save)
- `SAVED` → `MODIFIED` (edit)
- `MODIFIED` → `SAVED` (save changes)
- `SAVED` → `FINALIZED` (finalize)

---

## Idempotency

All modification endpoints (POST, PUT, PATCH) support idempotency via the `Idempotency-Key` header.

**Usage**:
```http
POST /api/v3/invoices
Idempotency-Key: unique-operation-key-123
```

**Behavior**:
- First request: Processes normally
- Subsequent requests with same key: Returns cached response
- Key expires after 24 hours
- Keys are scoped per user

**Response Headers**:
```json
{
  "success": true,
  "invoice": {},
  "_meta": {
    "idempotent": true,
    "originalTimestamp": "2024-01-01T12:00:00Z"
  }
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Error Codes
- `VALIDATION_FAILED` - Input validation error
- `RESOURCE_NOT_FOUND` - Invoice not found
- `UNAUTHORIZED` - Authentication required
- `CONFLICT` - Optimistic locking conflict
- `FORBIDDEN` - Access denied

---

## Data Integrity Guarantees

### Optimistic Locking
- Version numbers prevent concurrent edit conflicts
- Updates check expected version if provided
- Conflict resolution via version mismatch errors

### Immutable Fields
These fields cannot be changed after creation:
- `id` - Resource identifier
- `createdAt` - Creation timestamp
- `userId`, `userEmail` - Ownership fields

### Preserved Fields
These fields are preserved across updates:
- `id`, `createdAt` - Never change
- `savedAt` - Only updates on state transitions
- `finalizedAt` - Set once when finalized

### Calculated Fields
These fields are automatically computed:
- `subtotal`, `taxAmount`, `total` - From line items
- `grossProfit`, `profitPercent` - From costs and pricing
- `vesselName`, `customerName` - Extracted for indexing
- `updatedAt` - Current timestamp on changes
- `version` - Incremented on updates

---

## Migration from V2

### Breaking Changes
- Explicit HTTP method semantics (PUT vs PATCH vs POST)
- State-based lifecycle instead of status strings
- Version-based optimistic locking
- Idempotency support required for safe operations

### Compatibility
- V2 endpoints remain available during transition
- Smart-save endpoint provides V2-like behavior
- Database supports both old `status` and new `state` fields

### Migration Path
1. Update client to use specific HTTP methods
2. Add idempotency keys to modification requests
3. Handle new state values and version conflicts
4. Test with V3 endpoints before deprecating V2

---

## Performance Considerations

### Indexing
- Primary indexes: `id`, `userId`, `userEmail`
- Secondary indexes: `state`, `version`, `customerName`, `vesselName`
- Composite indexes: `(state, savedAt)`, `(userId, updatedAt)`

### Caching
- Idempotency responses cached for 24 hours
- GET responses cacheable with appropriate headers
- ETags based on version numbers

### Pagination
- Default page size: 20 items
- Maximum page size: 100 items
- Cursor-based pagination for large datasets

---

## Security

### Authentication
- Session-based authentication required
- Test user bypass for development/testing
- API key support for service-to-service calls

### Authorization
- User can only access their own invoices
- Master users can access all invoices (via different endpoints)
- Resource-level permissions enforced at repository layer

### Data Protection
- Input validation on all fields
- SQL injection prevention via Prisma ORM
- XSS protection via content security policy
- Rate limiting on modification endpoints