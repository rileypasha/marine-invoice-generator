# Auth-Aware Invoice Management System

A robust invoice management system with comprehensive auth-aware request handling, offline support, and session management.

## Features

- ✅ **Auth-Aware Save Queue**: Prevents network saves when logged out
- ✅ **IndexedDB Local Storage**: Drafts saved locally when offline/logged out  
- ✅ **Session Expiry Handling**: Graceful handling with user notifications
- ✅ **Idempotency Support**: Prevents duplicate saves with unique keys
- ✅ **CSRF Protection**: Double-submit cookie pattern
- ✅ **Request Correlation**: Track requests with correlation IDs
- ✅ **Comprehensive Testing**: Unit, integration, and E2E tests

## Quick Start

```bash
# Install dependencies
npm install

# Development mode (frontend + backend)
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
```

## Architecture

### Frontend
- **Auth Store**: Manages authentication state and session lifecycle
- **API Client**: Centralized request handling with 401 interception
- **Save Queue**: IndexedDB-backed queue for offline/logged-out saves
- **Invoice Service**: Auth-gated save operations with auto-save
- **React Components**: Session banner, queued saves modal

### Backend
- **Express Server**: Node.js with TypeScript
- **Session Management**: Redis-backed sessions with 30min TTL
- **Security**: CSRF tokens, rate limiting, secure cookies
- **Idempotency**: Prevents duplicate operations
- **Structured Logging**: Winston with correlation IDs

## Key Flows

### Logged Out Save
1. User edits invoice while logged out
2. Save attempt blocked at auth gate
3. Data stored in IndexedDB queue
4. Toast notification: "Draft saved locally"
5. No network requests made

### Session Expiry
1. User editing with active session
2. Session expires (30min timeout)
3. Next save receives 401
4. Banner appears: "Session expired - log in to save"
5. Form state preserved, changes queued locally

### Post-Login Sync
1. User logs in with pending changes
2. Review modal appears with queued items
3. User selects items to submit
4. Batch submission with idempotency keys
5. Success/failure feedback per item

## Security Features

- **HttpOnly Cookies**: Session cookies inaccessible to JS
- **SameSite=Strict**: CSRF protection via cookie policy
- **CSRF Tokens**: Required for state-changing operations
- **Rate Limiting**: Prevents brute force and DOS
- **Correlation IDs**: Request tracking and debugging
- **No Sensitive Data Logging**: Passwords/tokens redacted

## Testing

### Unit Tests
```bash
npm run test:unit
```
- API client 401 handling
- Save queue operations
- Auth middleware
- Idempotency logic

### Integration Tests
```bash
npm run test:integration
```
- Full auth flow
- CSRF validation
- Session management
- Idempotency verification

### E2E Tests
```bash
npm run test:e2e
```
- Logged out compose
- Session expiry handling
- Post-login queue flush
- Multi-tab consistency
- Offline/online transitions

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production
SESSION_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=https://app.example.com,https://www.example.com
COOKIE_DOMAIN=.example.com

# Logging
LOG_LEVEL=info
LOG_DIR=logs

# Security
TRUST_PROXY=true
```

## API Endpoints

### Auth
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout (CSRF required)
- `GET /api/v1/auth/check` - Session status
- `POST /api/v1/auth/refresh` - Extend session (CSRF required)
- `GET /api/v1/csrf-token` - Get CSRF token

### Invoice
- `POST /api/v1/invoice/save` - Save invoice (auth + CSRF + idempotency)
- `GET /api/v1/invoice/:id` - Get invoice (auth required)
- `GET /api/v1/invoice` - List invoices (auth required)
- `DELETE /api/v1/invoice/:id` - Delete invoice (auth + CSRF)

## Monitoring

### Metrics Endpoint
```bash
GET /metrics
```

Provides:
- Request counts by status code
- Auth failure counts
- Queue sizes
- Response time percentiles

### Health Check
```bash
GET /health
```

## Troubleshooting

### 401 Errors
- Check session cookie presence
- Verify session hasn't expired (30min TTL)
- Ensure credentials: 'include' in fetch

### 403 CSRF Errors
- Verify X-CSRF-Token header present
- Check token matches session token
- Ensure cookies are being sent

### Queue Not Flushing
- Verify authenticated state
- Check IndexedDB storage quota
- Review browser console for errors

## License

MIT