#!/bin/bash
set -Eeuo pipefail

echo "=== Starting Next.js Server ==="
echo "Current directory: $(pwd)"
echo "PORT environment variable: ${PORT:-not set (will use 5000)}"
echo ""

# 设置环境变量
export PORT="${PORT:-5000}"
export HOSTNAME="0.0.0.0"
export NODE_ENV="production"
export NEXT_TELEMETRY_DISABLED=1
export __NEXT_PRIVATE_STANDALONE_CONFIG=1

echo "Environment configuration:"
echo "  PORT=$PORT"
echo "  HOSTNAME=$HOSTNAME"
echo "  NODE_ENV=$NODE_ENV"
echo "  NEXT_TELEMETRY_DISABLED=$NEXT_TELEMETRY_DISABLED"
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
echo ""

echo "Checking critical resources:"
echo ""

# 检查.next/static目录
if [ -d "$SERVER_DIR/.next/static" ]; then
    echo "✓ .next/static directory exists"
    echo "  Contents:"
    ls "$SERVER_DIR/.next/static/" 2>/dev/null | head -5
    echo ""

    # 检查chunks目录
    if [ -d "$SERVER_DIR/.next/static/chunks" ]; then
        CHUNK_COUNT=$(ls "$SERVER_DIR/.next/static/chunks/" 2>/dev/null | wc -l)
        echo "  Chunks count: $CHUNK_COUNT"
        echo "  Sample chunks:"
        ls "$SERVER_DIR/.next/static/chunks/" 2>/dev/null | head -3
    fi
    echo ""

    # 检查CSS文件
    CSS_COUNT=$(find "$SERVER_DIR/.next/static" -name "*.css" -type f 2>/dev/null | wc -l)
    JS_COUNT=$(find "$SERVER_DIR/.next/static" -name "*.js" -type f 2>/dev/null | wc -l)
    echo "  CSS files: $CSS_COUNT"
    echo "  JS files: $JS_COUNT"
else
    echo "✗ .next/static directory does not exist"
    echo ""
    echo "Listing .next directory:"
    ls -la "$SERVER_DIR/.next/" 2>/dev/null || echo "No .next directory"
    echo ""
    echo "WARNING: Static resources may not be accessible!"
fi
echo ""

# 检查public目录
if [ -d "$SERVER_DIR/public" ]; then
    echo "✓ public directory exists"
    PUBLIC_COUNT=$(find "$SERVER_DIR/public" -type f 2>/dev/null | wc -l)
    echo "  Public files: $PUBLIC_COUNT"
else
    echo "✗ public directory does not exist"
fi
echo ""

# 检查manifest文件
echo "Checking build manifests:"
MANIFEST_FOUND=0
for manifest in build-manifest.json routes-manifest.json; do
    MANIFEST_PATH="$SERVER_DIR/.next/$manifest"
    if [ -f "$MANIFEST_PATH" ]; then
        echo "  ✓ $manifest"
        MANIFEST_FOUND=$((MANIFEST_FOUND + 1))
    fi
done

if [ $MANIFEST_FOUND -eq 0 ]; then
    echo "  ⚠ No manifest files found - may indicate incomplete build"
fi
echo ""

echo "========================================"
echo "Starting Next.js server on port $PORT..."
echo "========================================"
echo ""

# 启动server
exec node server.js
