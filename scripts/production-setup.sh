#!/bin/bash

# Production Setup Script for Marine Group Invoice System
# Run this after deployment to ensure users are properly configured

echo "🚀 Marine Group Production Setup"
echo "================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "🔧 Step 1: Reset user passwords"
echo "-------------------------------"
npm run reset:passwords

echo ""
echo "🌱 Step 2: Seed database (if needed)"
echo "------------------------------------"
npm run seed:database

echo ""
echo "🔍 Step 3: List current users"
echo "-----------------------------"
echo "You can check users via:"
echo "  curl -H 'x-debug-auth: enable' https://mginvoices.com/api/v1/auth/debug-users"

echo ""
echo "✅ Production setup completed!"
echo ""
echo "📝 Login credentials:"
echo "  • test@marinegroupbw.com / TestPassword123!"
echo "  • admin@mginvoices.com / AdminPassword123!"
echo "  • user@mginvoices.com / UserPassword123!"
echo ""
echo "🌐 Test login at: https://mginvoices.com"