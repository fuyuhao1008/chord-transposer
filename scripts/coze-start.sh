#!/bin/bash
set -Eeuo pipefail

echo "Starting server..."
echo "Current directory: $(pwd)"
echo "Directory structure:"
ls -la

# 尝试找到并启动Next.js server.js
FOUND=0

# 1. 当前目录有server.js（可能是standalone部署后的位置）
if [ -f "server.js" ]; then
    echo "✓ Found server.js in current directory"
    PORT="${PORT:-5000}" node server.js
    FOUND=1

# 2. workspace/projects目录
elif [ -f "workspace/projects/server.js" ]; then
    echo "✓ Found server.js in workspace/projects"
    cd workspace/projects
    PORT="${PORT:-5000}" node server.js
    FOUND=1

# 3. .next/standalone/workspace/projects目录（沙箱环境）
elif [ -f ".next/standalone/workspace/projects/server.js" ]; then
    echo "✓ Found server.js in .next/standalone/workspace/projects"
    cd .next/standalone/workspace/projects
    PORT="${PORT:-5000}" node server.js
    FOUND=1

# 4. 在.next目录中查找standalone server.js（排除node_modules）
elif [ -d ".next" ]; then
    echo "Searching for Next.js standalone server.js..."
    SERVER_FILE=$(find .next -name "server.js" -type f -not -path "*/node_modules/*" 2>/dev/null | head -1)
    if [ -n "$SERVER_FILE" ]; then
        echo "✓ Found Next.js server.js at: $SERVER_FILE"
        DIR=$(dirname "$SERVER_FILE")
        cd "$DIR"
        PORT="${PORT:-5000}" node server.js
        FOUND=1
    fi
fi

if [ $FOUND -eq 0 ]; then
    echo "✗ Error: Cannot find Next.js standalone server.js"
    echo ""
    echo "Debugging info:"
    echo "  - Current directory: $(pwd)"
    echo "  - Listing .next directory (if exists):"
    if [ -d ".next" ]; then
        ls -la .next/
        echo ""
        echo "  - All server.js files (excluding node_modules):"
        find . -name "server.js" -type f -not -path "*/node_modules/*" 2>/dev/null
    else
        echo "  - No .next directory found"
    fi
    exit 1
fi
