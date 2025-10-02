# Pagination Implementation Guide

## Changes Needed for Customers.tsx

### 1. Add Pagination State (around line 64)
After line 64 `const [is Loading, setIsLoading] = useState(true);`, add:
```typescript
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
```

### 2. Modify fetchCustomers function (line 109-150)
Change line 117-118 from:
```typescript
page: '1',
limit: '1000', // Fetch all customers for client-side pagination
```

To:
```typescript
page: currentPage.toString(),
limit: '25', // Server-side pagination
```

### 3. Update pagination state after fetch (after line 146)
Change lines 143-147 from:
```typescript
// Update total count for header display
if (data.pagination) {
  setTotalCustomers(data.pagination.total);
} else {
  setTotalCustomers(data.customers?.length || 0);
}
```

To:
```typescript
// Update total count and pagination
if (data.pagination) {
  setTotalCustomers(data.pagination.total);
  setTotalPages(data.pagination.totalPages || 1);
} else {
  setTotalCustomers(data.customers?.length || 0);
  setTotalPages(1);
}
```

### 4. Add currentPage dependency to useEffect
Find the useEffect that calls fetchCustomers and add `currentPage` to the dependency array.

### 5. Add Pagination import (top of file, around line 15)
```typescript
import { Pagination } from '../components/ui/pagination';
```

### 6. Add pagination controls (after ContactsTable closes, around line 856)
After the closing `/>` of ContactsTable, add:
```typescript
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
/>
```

## Changes Needed for Vessels.tsx

Follow the same pattern as Customers.tsx above:

1. Add pagination state variables
2. Change limit from '1000' to '25'
3. Update pagination state after fetch
4. Add currentPage to useEffect dependencies
5. Import Pagination component
6. Add Pagination controls after VesselsTable

## Testing

1. Restart frontend if needed: `npm run dev`
2. Navigate to Contacts page - should show 25 contacts per page
3. Navigate to Vessels page - should show 25 vessels per page
4. Test pagination controls work correctly
