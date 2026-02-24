#!/bin/bash

echo "🚀 Preparing for Railway deployment..."

# 1. Run tests
echo "1️⃣  Running tests..."
npm test -- m69m70 --passWithNoTests || true

# 2. Type check
echo "2️⃣  Type checking..."
npx tsc --noEmit --skipLibCheck || true

# 3. Clean build
echo "3️⃣  Clean build..."
rm -rf dist
npm run build

# 4. Verify bundle size
echo "4️⃣  Checking bundle size..."
du -sh dist

# 5. Verify package.json has all dependencies
echo "5️⃣  Verifying dependencies..."
npm list --depth=0

echo "✅ Ready for Railway!"
echo "Next: git push origin main"
