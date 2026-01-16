#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH:-$(pwd)}"

echo "Installing dependencies..."
pnpm install

echo "Building the project..."
pnpm build

echo "Build completed successfully!"

echo "Listing .next/standalone directory:"
if [ -d ".next/standalone" ]; then
    ls -la .next/standalone/
    echo ""
    echo "Checking for server.js:"
    find .next/standalone -name "server.js" -type f 2>/dev/null | head -5
else
    echo "No .next/standalone directory found"
fi
