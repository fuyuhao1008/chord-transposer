#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH:-$(pwd)}"

echo "Installing dependencies..."
pnpm install

echo "Building the project..."
pnpm build

echo "Build completed successfully!"

# 复制public目录到standalone输出
echo "Copying public directory to standalone output..."
if [ -d "public" ] && [ -d ".next/standalone" ]; then
    cp -r public .next/standalone/workspace/projects/
    echo "✓ Public directory copied"
fi

# 复制.next/static目录到standalone输出
echo "Copying static files to standalone output..."
if [ -d ".next/static" ] && [ -d ".next/standalone/workspace/projects/.next" ]; then
    cp -r .next/static .next/standalone/workspace/projects/.next/
    echo "✓ Static files copied"
fi

echo "Listing .next/standalone directory:"
if [ -d ".next/standalone" ]; then
    ls -la .next/standalone/workspace/projects/
    echo ""
    echo "Checking for server.js:"
    find .next/standalone -name "server.js" -type f 2>/dev/null | head -5
else
    echo "No .next/standalone directory found"
fi
