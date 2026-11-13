#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Node.js 22+ required"; exit 1; }
echo "LUMAVUN Market Gateway: http://localhost:8000"
node server/index.mjs
