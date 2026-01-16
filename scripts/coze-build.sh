#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH:-$(pwd)}"

echo "Installing dependencies..."
pnpm install

echo "Building the project..."
pnpm build

echo "Build completed successfully!"
