#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f ".env.modelkeys" ]]; then
  source ./.env.modelkeys
fi

# Ensure sourced values are available to node.
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"
export GITHUB_TOKEN="${GITHUB_TOKEN:-}"
export PORT="${PORT:-3000}"

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  read -rsp "Enter GEMINI_API_KEY: " GEMINI_API_KEY
  echo
  export GEMINI_API_KEY
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  read -rsp "Enter GITHUB_TOKEN: " GITHUB_TOKEN
  echo
  export GITHUB_TOKEN
fi

echo "Starting unified server on http://localhost:${PORT} (Both routes enabled) ..."
exec /usr/local/bin/node server.js
