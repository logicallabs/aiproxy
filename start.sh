#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

# Prefer standard .env for local/dev, but keep legacy .env.modelspecs compatibility.
if [[ -f ".env" ]]; then
  source ./.env
elif [[ -f ".env.modelspecs" ]]; then
  source ./.env.modelspecs
fi

# Optional machine-specific Node/DO overrides can live in .node.local.env.
if [[ -f ".node.local.env" ]]; then
  source ./.node.local.env
fi

# Ensure sourced values are available to node.
export PORT="${PORT:-3000}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"
export GEMINI_MODEL="${GEMINI_MODEL:-}"
export GEMINI_URL="${GEMINI_URL:-}"
export GITHUB_TOKEN="${GITHUB_TOKEN:-}"
export GH_URL="${GH_URL:-}"
export OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
export OPENROUTER_URL=${OPENROUTER_URL:-}
export DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-}
export DEEPSEEK_URL=${DEEPSEEK_URL:-}

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

if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Warning: OPENROUTER_API_KEY is not set. The OpenRouter route will stay disabled until it is configured." >&2
fi

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "Warning: DEEPSEEK_API_KEY is not set. The DeepSeek route will stay disabled until it is configured." >&2
fi

if [[ -z "${GEMINI_URL:-}" ]]; then
  echo "Warning: GEMINI_URL is not set. The Gemini route will stay disabled until it is configured." >&2
fi

if [[ -z "${GH_URL:-}" ]]; then
  echo "Warning: GH_URL is not set. The GitHub Models route will stay disabled until it is configured." >&2
fi

if [[ -z "${OPENROUTER_URL:-}" ]]; then
  echo "Warning: OPENROUTER_URL is not set. The OpenRouter route will stay disabled until it is configured." >&2
fi

if [[ -z "${DEEPSEEK_URL:-}" ]]; then
  echo "Warning: DEEPSEEK_URL is not set. The DeepSeek route will stay disabled until it is configured." >&2
fi

echo "Starting unified server on http://localhost:${PORT} (Gemini, GitHub Models, OpenRouter, and DeepSeek routes configured as available) ..."
exec node server.cjs
