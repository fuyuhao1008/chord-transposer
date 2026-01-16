#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH:-$(pwd)}/.next/standalone/workspace/projects"

echo "Starting server..."
PORT="${PORT:-5000}" node server.js
