#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE="$ROOT/examples/embed-react"

cd "$EXAMPLE"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created examples/embed-react/.env — set VITE_DOGRAH_EMBED_TOKEN before starting a call."
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

npm run dev
