# Marine Invoice Generator

Professional invoice generator for Marine Group services with advanced address autocomplete functionality powered by Geoapify.

## Features

- **Comprehensive Invoice Management**: Create, edit, and manage marine service invoices
- **Smart Address Autocomplete**: Real-time address suggestions with Geoapify integration
- **Accessible Design**: WCAG-compliant interface with full keyboard navigation
- **Secure Architecture**: Server-side API proxy with rate limiting and validation
- **Progressive Enhancement**: Graceful fallback when services are unavailable
- **Modern Tech Stack**: Node.js/Express backend with vanilla JavaScript frontend

## Quick Start

### Prerequisites

- Node.js 16+
- PostgreSQL 15+ (or Docker for development)
- Geoapify API key ([Get one free](https://www.geoapify.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/marine-invoice-generator.git
   cd marine-invoice-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure your environment**
   Edit `.env.local` with your settings:
   ```env
   # Database - Use your PostgreSQL connection string
   DATABASE_URL="postgresql://username:password@host:5432/database?sslmode=require"

   # Geoapify API Key (REQUIRED for address autocomplete)
   GEOAPIFY_API_KEY=your-geoapify-api-key-here

   # Server
   NODE_ENV=development
   PORT=3001
   SESSION_SECRET=your-secure-session-secret-here

   # Master Dashboard
   MASTER_EMAILS=your-admin-email@example.com
   ```

5. **Start the database** (using Docker)
   ```bash
   docker-compose up -d postgres
   ```

6. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

7. **Start the development server**
   ```bash
   npm run server:dev
   ```

8. **Build and serve the frontend** (in another terminal)
   ```bash
   npm run build
   npm run dev
   ```

The application will be available at `http://localhost:3001`

## Geoapify Setup

### Getting Your API Key

1. Visit [Geoapify](https://www.geoapify.com/) and create a free account
2. Navigate to your dashboard and create a new API key
3. Copy the API key to your `.env` file as `GEOAPIFY_API_KEY`

### Address Autocomplete Features

- **Real-time Suggestions**: Get address suggestions as you type
- **Global Coverage**: Worldwide address database
- **Smart Formatting**: Automatically fills city, state, postal code, and country
- **Accessibility**: Full keyboard navigation and screen reader support
- **Rate Limiting**: Built-in protection against API abuse
- **Caching**: 5-minute cache for improved performance
- **Fallback**: Manual address entry when autocomplete is unavailable

### API Usage Limits

- **Free Tier**: 3,000 requests/day
- **Paid Plans**: Higher limits available
- **Rate Limiting**: Application enforces 30 requests/minute per IP

## Local vs Production Environment

### Database Configuration Rules

**🚨 CRITICAL: Never commit SQLite or localhost database URLs**

- **Local Development**: Use `.env.local` with your PostgreSQL connection string
- **Production**: Uses Render's internal DATABASE_URL environment variable
- **NO SQLite**: This project only supports PostgreSQL in all environments
- **NO localhost**: Never hardcode localhost URLs in committed code

### Environment Files

- `.env.example` - Template with placeholder values (committed)
- `.env.local` - Your actual local settings (NOT committed, in .gitignore)
- Production uses Render environment variables (no .env file)

### Pre-commit Guardrails

This repository has guardrails to prevent database configuration mistakes:

```bash
# Manual pre-commit check
npm run precommit

# This will fail if you try to commit:
# - sqlite: URLs
# - file: URLs
# - postgresql://localhost URLs
# - postgresql://127.0.0.1 URLs
```

**Rule**: Always use `process.env.DATABASE_URL` and never hardcode database connections.

## Development

### Project Structure

```
marine-invoice-generator/
├── server/                 # Backend Express.js application
│   ├── routes/            # API route handlers
│   │   └── geo.js         # Geoapify proxy endpoint
│   ├── middleware/        # Authentication, validation, etc.
│   └── server.js          # Main server file
├── src/                   # Frontend application
│   ├── js/components/     # Reusable UI components
│   │   ├── AddressAutocomplete.js  # Address autocomplete component
│   │   └── CustomerForm.js         # Customer form with address integration
│   ├── styles/           # CSS stylesheets
│   └── index.html        # Main application HTML
├── prisma/               # Database schema and migrations
├── test/                 # Test suite
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── e2e/             # End-to-end tests
└── .env.example         # Environment configuration template
```

### Available Scripts

```bash
# Development
npm run server:dev      # Start development server
npm run dev            # Start webpack dev server
npm run build          # Build production assets

# Database
npm run db:migrate     # Run database migrations
npm run db:reset       # Reset database (WARNING: destroys data)

# Testing
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests
npm run test:e2e      # Run end-to-end tests

# Quality Assurance
npm run ci:lint       # ESLint code checking
npm run ci:security   # Security audit
npm run quality:check # Full quality check

# Docker
npm run docker:dev    # Start development environment
npm run docker:test   # Start testing environment
```

### Testing

The application includes comprehensive test coverage:

#### Unit Tests
```bash
npm run test:unit
```
Tests individual components and API endpoints including:
- Geoapify proxy validation and security
- Address autocomplete component behavior
- Input validation and error handling

#### Integration Tests
```bash
npm run test:integration
```
Tests component integration and data flow:
- Address autocomplete with backend API
- Customer form data persistence
- Error handling and fallback behavior

#### End-to-End Tests
```bash
npm run test:e2e
```
Tests complete user workflows:
- Address search and selection
- Form completion and submission
- Accessibility and keyboard navigation
- Mobile responsiveness

### Code Quality

The project maintains high code quality standards:

- **ESLint**: Code style and error checking
- **Security Audits**: Regular dependency vulnerability scans
- **Test Coverage**: >80% code coverage target
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Lighthouse score >90

## Deployment

### Environment Configuration

#### Development
```env
NODE_ENV=development
DATABASE_URL="postgresql://marine:invoice123@localhost:5432/marine_invoice_dev"
GEOAPIFY_API_KEY=your-dev-api-key
```

#### Production
```env
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host:port/database"
GEOAPIFY_API_KEY=your-production-api-key
SESSION_SECRET=your-strong-session-secret
CORS_ORIGINS=https://yourdomain.com
```

### Database Migrations

Production deployments automatically run migrations on startup. For manual migration:

```bash
npm run db:migrate:prod
```

### Docker Deployment

```bash
# Build and deploy
npm run docker:build
npm run docker:prod

# View logs
npm run docker:logs
```

## Security

### API Security

- **Server-side Proxy**: Geoapify API key never exposed to client
- **Rate Limiting**: 30 requests/minute per IP address
- **Input Validation**: All parameters sanitized and validated
- **Request Timeout**: 3-second timeout prevents resource exhaustion
- **Error Sanitization**: No sensitive information in error responses

### Best Practices

- API keys stored in environment variables only
- HTTPS enforced in production
- Session security with secure cookies
- CORS properly configured
- Helmet.js security headers
- Regular security audits

## Troubleshooting

### Common Issues

#### Address Autocomplete Not Working

1. **Check API Key**: Verify `GEOAPIFY_API_KEY` is set correctly
   ```bash
   curl "http://localhost:3001/api/geo/address-autocomplete?query=123%20Main%20St"
   ```

2. **Check API Quota**: Monitor your Geoapify dashboard for quota usage

3. **Network Issues**: Check for firewall or proxy blocking api.geoapify.com

#### Database Connection Issues

1. **PostgreSQL Running**: Ensure PostgreSQL is running and accessible
   ```bash
   docker-compose ps postgres
   ```

2. **Connection String**: Verify `DATABASE_URL` format
   ```
   postgresql://username:password@host:port/database
   ```

3. **Migration Status**: Check if migrations are current
   ```bash
   npm run db:check
   ```

#### Performance Issues

1. **Address Caching**: Monitor cache hit rates in server logs
2. **Rate Limiting**: Check for rate limit warnings in logs
3. **Database Queries**: Use query logging for slow operations

### Logging

Application logs include:
- Address autocomplete request/response timing
- Rate limiting events
- API error details
- Database operation performance

Access logs:
```bash
# Development
npm run logs:app

# Production
npm run docker:logs
```

## API Reference

### Address Autocomplete Endpoint

```
GET /api/geo/address-autocomplete
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Address search query (min 3 chars, max 200) |
| `limit` | integer | No | Max results (1-10, default: 5) |
| `lang` | string | No | Language code (default: 'en') |

#### Response

```json
[
  {
    "label": "123 Main Street, New York, NY 10001, USA",
    "line1": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "USA",
    "lat": 40.7128,
    "lon": -74.0060
  }
]
```

#### Error Responses

```json
// Validation Error (400)
{
  "error": "Query too short",
  "message": "Query must be at least 3 characters long"
}

// Rate Limit (429)
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60
}

// Service Error (502)
{
  "error": "External service error",
  "message": "Address lookup service is temporarily unavailable"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Commit Message Format

```
feat(scope): add amazing feature
fix(scope): resolve issue with component
docs(scope): update API documentation
test(scope): add missing test coverage
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review the test suite for usage examples

## Changelog

### v1.0.2 - Address Autocomplete
- Added Geoapify-powered address autocomplete
- Secure server-side API proxy
- WCAG-compliant accessible interface
- Comprehensive test coverage
- Mobile-responsive design

### v1.0.1 - Initial Release
- Basic invoice management
- Customer and vessel information
- PDF export functionality
- Master dashboard