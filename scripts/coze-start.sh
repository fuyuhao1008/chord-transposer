#!/bin/bash
set -Eeuo pipefail

echo "=== Starting Next.js server ==="
echo "Current directory: $(pwd)"
echo "PORT environment variable: ${PORT:-not set}"
echo ""

# 尝试找到并启动Next.js server.js
FOUND=0
SERVER_DIR=""

# 1. 当前目录有server.js（可能是standalone部署后的位置）
if [ -f "server.js" ]; then
    echo "✓ Found server.js in current directory"
    SERVER_DIR=$(pwd)
    FOUND=1

# 2. workspace/projects目录
elif [ -f "workspace/projects/server.js" ]; then
    echo "✓ Found server.js in workspace/projects"
    cd workspace/projects
    SERVER_DIR=$(pwd)
    FOUND=1

# 3. .next/standalone/workspace/projects目录（沙箱环境）
elif [ -f ".next/standalone/workspace/projects/server.js" ]; then
    echo "✓ Found server.js in .next/standalone/workspace/projects"
    cd .next/standalone/workspace/projects
    SERVER_DIR=$(pwd)
    FOUND=1

# 4. 在.next目录中查找standalone server.js（排除node_modules）
elif [ -d ".next" ]; then
    echo "Searching for Next.js standalone server.js..."
    SERVER_FILE=$(find .next -name "server.js" -type f -not -path "*/node_modules/*" 2>/dev/null | head -1)
    if [ -n "$SERVER_FILE" ]; then
        echo "✓ Found Next.js server.js at: $SERVER_FILE"
        DIR=$(dirname "$SERVER_FILE")
        cd "$DIR"
        SERVER_DIR=$(pwd)
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

echo ""
echo "Server directory: $SERVER_DIR"
echo "Directory contents:"
ls -la "$SERVER_DIR" | head -20
echo ""

echo "Checking for static resources:"
if [ -d "$SERVER_DIR/.next/static" ]; then
    echo "✓ .next/static directory exists"
    echo "  Static subdirectories:"
    ls "$SERVER_DIR/.next/static/" 2>/dev/null || echo "Cannot list"
    echo ""
    echo "  Sample chunk files:"
    ls "$SERVER_DIR/.next/static/chunks/" 2>/dev/null | head -5 || echo "Cannot list chunks"
else
    echo "✗ .next/static directory does not exist"
    echo ""
    echo "Listing .next directory:"
    ls -la "$SERVER_DIR/.next/" 2>/dev/null || echo "No .next directory"
fi
echo ""

echo "Checking for public directory:"
if [ -d "$SERVER_DIR/public" ]; then
    echo "✓ public directory exists"
else
    echo "✗ public directory does not exist"
fi
echo ""

echo "Starting server on port ${PORT:-5000}..."
echo "========================================"
echo ""

# 设置默认端口
export PORT="${PORT:-5000}"
export NODE_ENV="production"

# 启动server
exec node server.js
