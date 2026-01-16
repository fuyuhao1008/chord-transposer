#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH:-$(pwd)}"

echo "=== Starting build process ==="
echo "Current directory: $(pwd)"
echo "Workspace path: ${COZE_WORKSPACE_PATH:-$(pwd)}"
echo ""

echo "Step 1: Installing dependencies..."
pnpm install || {
    echo "ERROR: Failed to install dependencies"
    exit 1
}

echo "✓ Dependencies installed"
echo ""

echo "Step 2: Building the project..."
pnpm build || {
    echo "ERROR: Build failed"
    exit 1
}

echo "✓ Build completed successfully!"
echo ""

echo "Step 3: Copying public directory to standalone output..."
if [ -d "public" ]; then
    echo "Public directory exists"
    if [ -d ".next/standalone" ]; then
        echo "Standalone directory exists"
        # 确保目标目录存在
        mkdir -p .next/standalone/workspace/projects/

        # 使用 rsync 替代 cp，更可靠且支持进度显示
        echo "Copying public directory contents..."
        timeout 30 rsync -av --delete public/ .next/standalone/workspace/projects/public/ || {
            echo "ERROR: Failed to copy public directory"
            exit 1
        }
        echo "✓ Public directory copied successfully"
    else
        echo "WARNING: .next/standalone directory not found, skipping public copy"
    fi
else
    echo "WARNING: Public directory not found, skipping public copy"
fi
echo ""

echo "Step 4: Copying static files to standalone output..."
if [ -d ".next/static" ]; then
    echo "Static directory exists"
    if [ -d ".next/standalone" ]; then
        # 确保目标目录存在
        mkdir -p .next/standalone/workspace/projects/.next/

        echo "Copying static files..."
        timeout 30 rsync -av --delete .next/static/ .next/standalone/workspace/projects/.next/static/ || {
            echo "ERROR: Failed to copy static files"
            exit 1
        }
        echo "✓ Static files copied successfully"
    else
        echo "WARNING: .next/standalone directory not found, skipping static copy"
    fi
else
    echo "WARNING: .next/static directory not found, skipping static copy"
fi
echo ""

echo "Step 5: Verifying build output..."
if [ -d ".next/standalone" ]; then
    echo "✓ Standalone directory exists"
    echo ""
    echo "Directory structure:"
    ls -la .next/standalone/ 2>/dev/null || echo "Cannot list standalone root"
    echo ""
    if [ -d ".next/standalone/workspace/projects" ]; then
        echo "Projects directory contents:"
        ls -la .next/standalone/workspace/projects/ 2>/dev/null || echo "Cannot list projects"
        echo ""
    fi
    echo "Searching for server.js..."
    find .next/standalone -name "server.js" -type f 2>/dev/null | head -3 || echo "server.js not found"
else
    echo "ERROR: Standalone directory not found"
    exit 1
fi

echo ""
echo "=== Build process completed successfully ==="
