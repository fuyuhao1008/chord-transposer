#!/bin/bash
set -Eeuo pipefail

echo "Starting server..."
echo "Current directory: $(pwd)"

# 尝试找到server.js并启动
if [ -f "server.js" ]; then
    echo "Found server.js in current directory"
    PORT="${PORT:-5000}" node server.js
elif [ -f ".next/standalone/workspace/projects/server.js" ]; then
    echo "Found server.js in .next/standalone/workspace/projects"
    cd .next/standalone/workspace/projects
    PORT="${PORT:-5000}" node server.js
else
    echo "Searching for server.js..."
    SERVER_FILE=$(find . -name "server.js" -type f | head -1)
    if [ -n "$SERVER_FILE" ]; then
        echo "Found server.js at: $SERVER_FILE"
        cd $(dirname "$SERVER_FILE")
        PORT="${PORT:-5000}" node server.js
    else
        echo "Error: Cannot find server.js"
        exit 1
    fi
fi
