# CRITICAL: Invoice Sync Configuration
## DO NOT MODIFY WITHOUT UNDERSTANDING THIS DOCUMENT

### Overview
The invoice system uses a **dual-storage approach** to ensure data persistence:
1. **Server Database (PostgreSQL)** - Source of truth
2. **localStorage** - Local cache for performance

### How It Works

#### Master Dashboard
- **ALWAYS** fetches directly from server database
- Never relies on localStorage
- API: `/api/master/invoices`
- This is why master dashboard never loses data

#### Standard Users  
- **Primary**: Server database (source of truth)
- **Secondary**: localStorage (cache)
- On login: Automatically syncs from server via `/api/invoices/user`
- On save: Saves to BOTH localStorage and server

### Critical Code Locations

#### Server Sync (DO NOT REMOVE)
- **File**: `src/js/storage/InvoiceStorage.js`
- **Method**: `syncFromServer()`
- **Trigger**: Called automatically when user logs in
- **Purpose**: Fetches all user invoices from server and populates localStorage

#### API Endpoint (DO NOT REMOVE)
- **File**: `server/routes/user-invoices.js`
- **Route**: `GET /api/invoices/user`
- **Purpose**: Returns all invoices for logged-in user
- **Used by**: Standard user interface on login

#### Auto-sync on Login (DO NOT MODIFY)
```javascript
// In InvoiceStorage.js constructor
userManager.subscribe(async (user) => {
  if (user) {
    await this.syncFromServer(); // CRITICAL: This line prevents data loss
    this.migrateUserEmails();
  }
});
```

### Storage Keys
- localStorage key: `marine_invoices`
- Session key: `marine_invoice_session`
- User key: `marine_invoice_user`

### Debug Commands
```javascript
// Force sync from server
window.debugApp.syncFromServer()

// Check localStorage contents
window.debugApp.checkStorage()

// Show current user
window.debugApp.currentUser()
```

### Common Issues & Solutions

#### User sees 0 invoices
1. Check if logged in: `window.debugApp.currentUser()`
2. Force sync: `window.debugApp.syncFromServer()`
3. Check console for sync errors

#### localStorage cleared
- **Not a problem anymore!** Server sync automatically restores on login
- Manual fix: `window.debugApp.syncFromServer()`

### Warning
**NEVER** remove or modify the following without understanding the impact:
1. `syncFromServer()` method
2. `/api/invoices/user` endpoint
3. Auto-sync on login subscription
4. Server save in `saveInvoice()` method

Removing any of these will cause users to lose invoices when localStorage is cleared!