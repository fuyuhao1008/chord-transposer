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

echo "Step 2: Building project..."
# 禁用遥测收集
NEXT_TELEMETRY_DISABLED=1 pnpm build || {
    echo "ERROR: Build failed"
    exit 1
}

echo "✓ Build completed successfully!"
echo ""

echo "Step 3: Verifying .next/static directory..."
if [ -d ".next/static" ]; then
    echo "✓ .next/static directory exists"
    SOURCE_COUNT=$(find .next/static -type f | wc -l)
    echo "  Total static files: $SOURCE_COUNT"
    echo "  Sample chunks:"
    ls .next/static/chunks/ | head -5 2>/dev/null || echo "  (no chunks)"
    echo ""
else
    echo "ERROR: .next/static directory does not exist after build"
    exit 1
fi

echo "Step 4: Verifying .next/standalone directory..."
if [ -d ".next/standalone" ]; then
    echo "✓ .next/standalone directory was created by Next.js"
    echo "  Server file exists:"
    [ -f ".next/standalone/workspace/projects/server.js" ] && echo "  ✓ server.js" || echo "  ✗ server.js missing"
    echo ""
else
    echo "ERROR: .next/standalone directory was not created by Next.js build"
    exit 1
fi

echo "Step 5: Copying public directory to standalone output..."
if [ -d "public" ]; then
    echo "Public directory exists"
    if [ -d ".next/standalone/workspace/projects" ]; then
        echo "Copying public directory..."
        cp -rf public .next/standalone/workspace/projects/ || {
            echo "ERROR: Failed to copy public directory"
            exit 1
        }
        PUBLIC_COUNT=$(find .next/standalone/workspace/projects/public -type f | wc -l)
        echo "✓ Public directory copied ($PUBLIC_COUNT files)"
    else
        echo "WARNING: .next/standalone/workspace/projects directory not found, skipping public copy"
    fi
else
    echo "WARNING: Public directory not found, skipping public copy"
fi
echo ""

echo "Step 6: Copying static files to standalone output..."
if [ -d ".next/static" ]; then
    if [ -d ".next/standalone/workspace/projects/.next" ]; then
        echo "Target directory: .next/standalone/workspace/projects/.next/static"

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
        echo "Verification:"
        DEST_COUNT=$(find .next/standalone/workspace/projects/.next/static -type f | wc -l)
        echo "  Source files: $SOURCE_COUNT"
        echo "  Destination files: $DEST_COUNT"

        if [ "$SOURCE_COUNT" -eq "$DEST_COUNT" ]; then
            echo "✓ File counts match"
        else
            echo "⚠ File count difference: $((DEST_COUNT - SOURCE_COUNT))"
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

echo "Step 7: Verifying critical build artifacts..."
echo "Checking essential files:"
ESSENTIAL_FILES=(
    ".next/standalone/workspace/projects/server.js"
    ".next/standalone/workspace/projects/.next/static/chunks"
    ".next/standalone/workspace/projects/.next/server/app"
)

for file in "${ESSENTIAL_FILES[@]}"; do
    if [ -e "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ Missing: $file"
        exit 1
    fi
done
echo ""

echo "Step 8: Final structure check..."
echo "Standalone directory tree:"
tree -L 3 -d .next/standalone/workspace/projects/.next/ 2>/dev/null || find .next/standalone/workspace/projects/.next/ -maxdepth 3 -type d | head -20
echo ""

echo "=== Build process completed successfully ==="
echo ""
echo "Next steps:"
echo "  1. Run './scripts/verify-build.sh' for detailed verification"
echo "  2. Deploy to production"
