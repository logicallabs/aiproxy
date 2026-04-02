#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ (-z "${GEMINI_API_KEY:-}" || -z "${GITHUB_TOKEN:-}") && -f ".env.modelkeys" ]]; then
  source ./.env.modelkeys
fi

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
echo "Starting unified server on http://localhost:3000 (Both routes enabled) ..."
exec node server.js
