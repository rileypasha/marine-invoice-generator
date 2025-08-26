#!/bin/bash

# Kill any existing node processes
pkill -f "node server/server.js" 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true

# Start the server
echo "Starting server with authentication fixes..."
cd /mnt/c/Users/riley/Desktop/marine-group\ \(2\)/marine-group/marine-invoice-generator

# Set environment variables
export NODE_ENV=development
export SESSION_SECRET=dev-secret-change-in-production
export MASTER_EMAILS=rpasha@marinegroupbw.com
export LOG_LEVEL=info
export PORT=3001

# Start server
node server/server.js