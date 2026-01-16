#!/bin/bash
set -Eeuo pipefail

# 切换到项目目录
cd "${COZE_WORKSPACE_PATH:-$(pwd)}"

echo "=== Starting build process ==="
echo "Current directory: $(pwd)"
echo "Workspace path: ${COZE_WORKSPACE_PATH:-$(pwd)}"
echo ""

echo "Step 0: Cleaning old build artifacts..."
# 清理旧的.next/standalone目录，确保干净的构建
if [ -d ".next/standalone" ]; then
    echo "Removing old .next/standalone directory..."
    rm -rf .next/standalone
    echo "✓ Old standalone output removed"
fi

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

echo "Step 3: Verifying .next/static directory..."
if [ -d ".next/static" ]; then
    echo "✓ .next/static directory exists"
    echo "Contents of .next/static:"
    ls -la .next/static/ || echo "Cannot list"
    echo ""
    echo "Sample files in .next/static/chunks:"
    ls .next/static/chunks/ | head -10 || echo "Cannot list chunks"
    echo ""
else
    echo "ERROR: .next/static directory does not exist after build"
    exit 1
fi
echo ""

echo "Step 4: Verifying .next/standalone directory..."
if [ -d ".next/standalone" ]; then
    echo "✓ .next/standalone directory was created by Next.js"
    echo "Structure:"
    ls -la .next/standalone/workspace/projects/ 2>/dev/null || echo "Cannot list"
    echo ""
else
    echo "ERROR: .next/standalone directory was not created by Next.js build"
    exit 1
fi
echo ""

echo "Step 5: Copying public directory to standalone output..."
if [ -d "public" ]; then
    echo "Public directory exists"
    if [ -d ".next/standalone/workspace/projects" ]; then
        echo "Copying public directory..."
        cp -rf public .next/standalone/workspace/projects/ || {
            echo "ERROR: Failed to copy public directory"
            exit 1
        }
        echo "✓ Public directory copied successfully"
    else
        echo "WARNING: .next/standalone/workspace/projects directory not found, skipping public copy"
    fi
else
    echo "WARNING: Public directory not found, skipping public copy"
fi
echo ""

echo "Step 6: Copying static files to standalone output..."
if [ -d ".next/static" ]; then
    echo "Source .next/static directory exists"
    if [ -d ".next/standalone/workspace/projects/.next" ]; then
        echo "Target directory: .next/standalone/workspace/projects/.next/static"
        echo "Copying static files..."

        # 先删除旧的目标目录（如果存在），确保干净的复制
        if [ -d ".next/standalone/workspace/projects/.next/static" ]; then
            rm -rf .next/standalone/workspace/projects/.next/static
            echo "Removed old static directory"
        fi

        # 复制整个.next/static目录
        cp -r .next/static .next/standalone/workspace/projects/.next/ || {
            echo "ERROR: Failed to copy .next/static directory"
            exit 1
        }

        echo "✓ Static files copied successfully"
        echo ""
        echo "Verification of copied directory:"
        ls -la .next/standalone/workspace/projects/.next/static/ || echo "Cannot list"
        echo ""
        echo "Verifying copied chunks:"
        ls .next/standalone/workspace/projects/.next/static/chunks/ | head -10 || echo "Cannot list chunks"
        echo ""
        echo "Checking file count:"
        SOURCE_COUNT=$(find .next/static -type f | wc -l)
        TARGET_COUNT=$(find .next/standalone/workspace/projects/.next/static -type f | wc -l)
        echo "  Source files: $SOURCE_COUNT"
        echo "  Target files: $TARGET_COUNT"

        if [ "$SOURCE_COUNT" -ne "$TARGET_COUNT" ]; then
            echo "WARNING: File count mismatch!"
        else
            echo "✓ File count matches"
        fi
    else
        echo "ERROR: .next/standalone/workspace/projects/.next directory not found"
        exit 1
    fi
else
    echo "ERROR: .next/static directory not found"
    exit 1
fi
echo ""

echo "Step 7: Final verification..."
if [ -d ".next/standalone" ]; then
    echo "✓ Standalone directory exists"
    echo ""
    echo "Directory structure:"
    ls -la .next/standalone/workspace/projects/ 2>/dev/null || echo "Cannot list"
    echo ""

    echo "Searching for server.js:"
    find .next/standalone -name "server.js" -type f -not -path "*/node_modules/*" 2>/dev/null | head -3 || echo "server.js not found"
    echo ""

    echo "Checking for copied resources:"
    echo "  - Public dir:"
    [ -d ".next/standalone/workspace/projects/public" ] && echo "    ✓ exists" || echo "    ✗ missing"
    echo "  - Static dir:"
    [ -d ".next/standalone/workspace/projects/.next/static" ] && echo "    ✓ exists" || echo "    ✗ missing"
    echo "  - Static chunks:"
    [ -d ".next/standalone/workspace/projects/.next/static/chunks" ] && echo "    ✓ exists" || echo "    ✗ missing"
    echo ""
    echo "Checking static file sample:"
    if [ -d ".next/standalone/workspace/projects/.next/static/chunks" ]; then
        FILE_COUNT=$(ls .next/standalone/workspace/projects/.next/static/chunks/ | wc -l)
        echo "  Chunk files: $FILE_COUNT"
    fi
else
    echo "ERROR: Standalone directory not found"
    exit 1
fi

echo ""
echo "=== Build process completed successfully ==="
