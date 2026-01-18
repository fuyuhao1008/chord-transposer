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
# 使用环境变量禁用遥测收集
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
    ls .next/static/chunks/ 2>/dev/null | head -5 || echo "  (no chunks)"
    echo ""
else
    echo "ERROR: .next/static directory does not exist after build"
    exit 1
fi

echo "Step 4: Detecting standalone directory structure..."
# 查找server.js在standalone目录中的实际位置
STANDALONE_SERVER=""
STANDALONE_ROOT=""

# 方法1：直接查找根目录的server.js
if [ -f ".next/standalone/server.js" ]; then
    STANDALONE_ROOT=".next/standalone"
    STANDALONE_SERVER=".next/standalone/server.js"
    echo "Method 1: Found .next/standalone/server.js (root level)"

# 方法2：检查嵌套路径
elif [ -f ".next/standalone/workspace/projects/server.js" ]; then
    STANDALONE_ROOT=".next/standalone/workspace/projects"
    STANDALONE_SERVER=".next/standalone/workspace/projects/server.js"
    echo "Method 2: Found .next/standalone/workspace/projects/server.js (nested)"

# 方法3：使用find自动搜索
elif [ -d ".next/standalone" ]; then
    echo "Method 3: Searching for server.js in .next/standalone..."
    STANDALONE_SERVER=$(find .next/standalone -name "server.js" -type f -not -path "*/node_modules/*" 2>/dev/null | head -1)
    if [ -n "$STANDALONE_SERVER" ]; then
        STANDALONE_ROOT=$(dirname "$STANDALONE_SERVER")
        echo "Found: $STANDALONE_SERVER (auto-detected)"
    fi
fi

if [ -z "$STANDALONE_SERVER" ]; then
    echo "ERROR: Cannot find server.js in .next/standalone directory"
    echo ""
    echo "Debugging information:"
    echo "  .next/standalone exists: $([ -d .next/standalone ] && echo 'yes' || echo 'no')"
    echo ""
    echo "  Directory listing:"
    find .next/standalone -type f -not -path "*/node_modules/*" 2>/dev/null | head -20 || echo "  Directory empty or missing"
    echo ""
    echo "  All subdirectories:"
    find .next/standalone -type d 2>/dev/null | head -20 || echo "  No directories"
    exit 1
fi

echo "✓ Standalone directory structure detected"
echo "  Root: $STANDALONE_ROOT"
echo "  Server: $STANDALONE_SERVER"
echo ""

echo "Step 5: Copying public directory to standalone output..."
if [ -d "public" ]; then
    echo "Public directory exists"
    if [ -d "$STANDALONE_ROOT" ]; then
        echo "Copying public directory to $STANDALONE_ROOT/..."
        cp -rf public "$STANDALONE_ROOT/" || {
            echo "ERROR: Failed to copy public directory"
            exit 1
        }
        PUBLIC_COUNT=$(find "$STANDALONE_ROOT/public" -type f | wc -l)
        echo "✓ Public directory copied ($PUBLIC_COUNT files)"
    else
        echo "ERROR: Standalone root directory does not exist: $STANDALONE_ROOT"
        exit 1
    fi
else
    echo "WARNING: Public directory not found, skipping public copy"
fi
echo ""

echo "Step 6: Copying static files to standalone output..."
if [ -d ".next/static" ]; then
    if [ -d "$STANDALONE_ROOT" ]; then
        echo "Target directory: $STANDALONE_ROOT/.next/static"

        # 先删除旧的目标目录（如果存在），确保干净的复制
        if [ -d "$STANDALONE_ROOT/.next/static" ]; then
            rm -rf "$STANDALONE_ROOT/.next/static"
            echo "Removed old static directory"
        fi

        # 确保目标.next目录存在
        mkdir -p "$STANDALONE_ROOT/.next"

        # 复制整个.next/static目录
        cp -r .next/static "$STANDALONE_ROOT/.next/" || {
            echo "ERROR: Failed to copy .next/static directory"
            exit 1
        }

        echo "✓ Static files copied successfully"
        echo ""
        echo "Verification:"
        DEST_COUNT=$(find "$STANDALONE_ROOT/.next/static" -type f | wc -l)
        echo "  Source files: $SOURCE_COUNT"
        echo "  Destination files: $DEST_COUNT"

        if [ "$SOURCE_COUNT" -eq "$DEST_COUNT" ]; then
            echo "✓ File counts match"
        else
            echo "⚠ File count difference: $((DEST_COUNT - SOURCE_COUNT))"
        fi
    else
        echo "ERROR: Standalone root directory does not exist: $STANDALONE_ROOT"
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
    "$STANDALONE_SERVER"
    "$STANDALONE_ROOT/.next/static/chunks"
    "$STANDALONE_ROOT/.next/server"
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

echo "Step 8: Copying custom server script..."
if [ -f "scripts/custom-server.js" ]; then
    if [ -d "$STANDALONE_ROOT" ]; then
        echo "Copying custom server to $STANDALONE_ROOT/..."
        cp scripts/custom-server.js "$STANDALONE_ROOT/custom-server.js" || {
            echo "WARNING: Failed to copy custom server, will use standalone server"
        }
        echo "✓ Custom server copied"
    else
        echo "WARNING: Standalone root directory does not exist, skipping custom server copy"
    fi
else
    echo "WARNING: Custom server not found, skipping"
fi
echo ""

echo "Step 9: Final structure check..."
echo "Standalone directory tree ($STANDALONE_ROOT):"
if command -v tree >/dev/null 2>&1; then
    tree -L 2 -d "$STANDALONE_ROOT/" 2>/dev/null || find "$STANDALONE_ROOT/" -maxdepth 2 -type d | head -20
else
    find "$STANDALONE_ROOT/" -maxdepth 2 -type d | head -20
fi
echo ""

echo "=== Build process completed successfully ==="
echo ""
echo "Next steps:"
echo "  1. Run './scripts/verify-build.sh' for detailed verification"
echo "  2. Deploy to production"
