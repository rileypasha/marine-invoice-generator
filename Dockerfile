# Marine Invoice Generator - Production Container
# Multi-stage build for optimized production deployment

# ============================================================================
# Build Stage
# ============================================================================
FROM node:18-alpine AS builder

# Install security updates and build dependencies
RUN apk update && apk upgrade && apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY prisma/ ./prisma/

# Install all dependencies (including dev dependencies for build)
RUN npm ci --include=dev --prefer-offline

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build && npm run build:css

# Clean up dev dependencies and create production node_modules
RUN npm prune --production && npm cache clean --force

# ============================================================================
# Production Stage
# ============================================================================
FROM node:18-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S marine -u 1001 -G nodejs

WORKDIR /app

# Copy production files from builder
COPY --from=builder --chown=marine:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=marine:nodejs /app/dist ./dist
COPY --from=builder --chown=marine:nodejs /app/assets ./assets
COPY --from=builder --chown=marine:nodejs /app/server ./server
COPY --from=builder --chown=marine:nodejs /app/scripts ./scripts
COPY --from=builder --chown=marine:nodejs /app/prisma ./prisma
COPY --chown=marine:nodejs package*.json ./
COPY --chown=marine:nodejs electron.js ./

# Create required directories
RUN mkdir -p data logs reports && \
    chown -R marine:nodejs data logs reports

# Health check script
COPY --chown=marine:nodejs <<EOF /app/healthcheck.js
const http = require('http');
const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  timeout: 2000,
};

const request = http.request(options, (res) => {
  console.log(\`STATUS: \${res.statusCode}\`);
  if (res.statusCode == 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', function(err) {
  console.log('ERROR:', err);
  process.exit(1);
});

request.end();
EOF

# Switch to non-root user
USER marine

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node /app/healthcheck.js

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/server.js"]

# Metadata
LABEL maintainer="Marine Group <support@marinegroup.com>"
LABEL org.opencontainers.image.title="Marine Invoice Generator"
LABEL org.opencontainers.image.description="Production-ready marine invoice management system"
LABEL org.opencontainers.image.vendor="Marine Group"
LABEL org.opencontainers.image.licenses="MIT"