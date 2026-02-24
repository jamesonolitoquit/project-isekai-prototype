#!/bin/bash

echo "🧹 Cleaning build artifacts..."

# Remove old builds
rm -rf dist
rm -rf build
rm -rf .next
rm -rf coverage
rm -rf .webpack

# Remove logs
rm -f *.log
rm -rf logs

# Remove caches
rm -rf .eslintcache
rm -rf tsconfig.tsbuildinfo

echo "✅ Cleaned. Building fresh..."

# Build fresh
npm run build

echo "✅ Build complete"
ls -lh dist/ | head -10
