#!/bin/bash

echo "🔍 Testing authentication fix on mginvoices.com..."
echo ""

# Test 1: Check if we can access the main page without redirects
echo "📍 Test 1: Accessing mginvoices.com"
response=$(curl -s -o /dev/null -w "%{http_code} - %{redirect_url}" -L --max-redirs 5 https://mginvoices.com)
echo "Response: $response"

# Test 2: Check the /app endpoint
echo ""
echo "📍 Test 2: Accessing /app endpoint"
response=$(curl -s -o /dev/null -w "%{http_code} - %{redirect_url}" https://mginvoices.com/app)
echo "Response: $response"

# Test 3: Check authentication endpoint
echo ""
echo "📍 Test 3: Checking /api/auth/me endpoint"
response=$(curl -s -w "\nStatus: %{http_code}" https://mginvoices.com/api/auth/me)
echo "$response"

# Test 4: Count redirects
echo ""
echo "📍 Test 4: Counting redirects when accessing main page"
redirects=$(curl -s -o /dev/null -w "%{num_redirects}" -L --max-redirs 10 https://mginvoices.com)
echo "Number of redirects: $redirects"

if [ "$redirects" -le 2 ]; then
    echo ""
    echo "✅ SUCCESS: No infinite loop detected ($redirects redirects)"
    exit 0
else
    echo ""
    echo "⚠️  WARNING: Multiple redirects detected ($redirects redirects)"
    exit 1
fi