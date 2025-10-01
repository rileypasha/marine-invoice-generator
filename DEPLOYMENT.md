# Render Deployment Guide

## Recent Changes

### Profile Avatar Upload Feature
- Added file upload functionality for user avatars
- Configured persistent disk storage in `render.yaml`
- Created database migration for `avatarUrl` field

## Deployment Configuration

### File Storage
The application uses Render's persistent disk for storing uploaded avatars:
- **Mount Path**: `/opt/render/project/src/uploads`
- **Size**: 1GB
- **Purpose**: User avatar images

### Database Migrations
The deployment process includes automatic database migrations:
- **Command**: `npx prisma migrate deploy` (runs in `preDeployCommand`)
- **Location**: `prisma/migrations/`

### Build Process
1. **Build**: `npm install && npm run build:all`
   - Builds both client (React/Vite) and server (TypeScript)
2. **Pre-Deploy**: `npx prisma migrate deploy`
   - Applies database migrations before starting the service
3. **Post-Build**: `npm run reset:passwords`
   - Resets user passwords to secure defaults
4. **Start**: `npm run start:production`
   - Starts the Express server serving both API and static frontend

### Environment Variables
All environment variables are configured in `render.yaml`:
- `NODE_ENV`: production
- `PORT`: 10000
- `DATABASE_URL`: From PostgreSQL service
- `REDIS_URL`: From Redis service
- `SESSION_SECRET`: Auto-generated secure value
- `CORS_ORIGINS`: Allowed frontend origins
- `COOKIE_DOMAIN`: Cookie domain for session management

### Services
1. **Web Service**: `marine-group-invoices`
   - Serves both frontend and API
   - Node.js runtime
   - Starter plan
   - Oregon region

2. **PostgreSQL Database**: `marine-group-db`
   - Database: `marine_invoices`
   - Starter plan

3. **Redis**: `marine-group-redis`
   - Session storage
   - LRU eviction policy

## Manual Deployment Steps

If deploying manually (not via `render.yaml`):

1. **Create Persistent Disk** (if not already created):
   - Name: `uploads`
   - Mount Path: `/opt/render/project/src/uploads`
   - Size: 1GB

2. **Configure Environment Variables**:
   - Copy from `render.yaml` or Render dashboard
   - Ensure `DATABASE_URL` and `REDIS_URL` point to correct services

3. **Deploy**:
   - Push to GitHub (main branch or configured branch)
   - Render will auto-deploy if `autoDeploy: true`
   - Or trigger manual deploy from Render dashboard

## Post-Deployment

After deployment:
1. Verify `/uploads` endpoint serves files correctly
2. Test avatar upload functionality
3. Check database migrations applied: `SELECT * FROM "_prisma_migrations"`
4. Monitor logs for any multer or file upload errors

## Troubleshooting

### Avatar Upload Fails
- Check persistent disk is mounted at correct path
- Verify multer size limits (5MB max)
- Check disk space usage

### Database Migration Issues
- Manually run: `npx prisma migrate deploy`
- Check migration lock: `SELECT * FROM "_prisma_migrations" WHERE finished_at IS NULL`

### Session Issues
- Verify Redis connection
- Check `SESSION_SECRET` is set
- Confirm `COOKIE_DOMAIN` matches your domain
