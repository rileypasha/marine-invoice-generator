#!/bin/bash

echo "🔍 Testing login endpoint on mginvoices.com..."
echo ""

# Test login with a test email
echo "📍 Testing login endpoint"
response=$(curl -X POST https://mginvoices.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@marinegroupbw.com","password":"test"}' \
  -c cookies.txt \
  -v 2>&1)

echo "$response" | grep -E "< HTTP|< Set-Cookie|success"

echo ""
echo "📍 Testing /api/auth/me with cookie"
curl -b cookies.txt https://mginvoices.com/api/auth/me -v 2>&1 | grep -E "< HTTP|user"

# Clean up
rm -f cookies.txt

echo ""
echo "✅ Test complete"