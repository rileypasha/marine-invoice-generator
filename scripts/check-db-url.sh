#!/usr/bin/env bash
set -euo pipefail

# Guardrail script to prevent SQLite or localhost database URLs from being committed
# This prevents accidentally committing local development database configurations

echo "🔍 Checking for SQLite or localhost database URLs in staged changes..."

# Check for problematic patterns in staged changes
if git diff --cached -U0 | grep -Eiq '(sqlite:|file:|postgres(ql)?:\/\/(localhost|127\.0\.0\.1))'; then
  echo ""
  echo "❌ COMMIT REJECTED: Found SQLite or localhost DB URL in staged changes."
  echo ""
  echo "🚨 The following patterns are not allowed in commits:"
  echo "   • sqlite: URLs (use PostgreSQL instead)"
  echo "   • file: URLs (use PostgreSQL instead)"
  echo "   • postgresql://localhost URLs (use environment variables)"
  echo "   • postgresql://127.0.0.1 URLs (use environment variables)"
  echo ""
  echo "💡 Use DATABASE_URL environment variable in .env.local instead"
  echo "   Example: DATABASE_URL=\"postgresql://user:pass@host:5432/db?sslmode=require\""
  echo ""
  echo "🔧 To fix: Remove hardcoded database URLs and use process.env.DATABASE_URL"
  echo ""
  exit 1
fi

echo "✅ No problematic database URLs found in staged changes"