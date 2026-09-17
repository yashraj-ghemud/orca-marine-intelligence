#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Install Node.js 22 LTS from https://nodejs.org, then try again.'
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
printf '%s\n' 'Open http://localhost:3000 after the server says Ready.'
exec npm run dev
