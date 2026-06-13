#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f ".env" ]]; then
  # .env holds provider credentials and stays untracked.
  source ./.env
fi

if [[ -f ".node.local.env" ]]; then
  # .node.local.env holds machine-specific Node/DO details and stays untracked.
  source ./.node.local.env
fi

export PORT="${PORT:-3000}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"
export GEMINI_MODEL="${GEMINI_MODEL:-}"
export GEMINI_URL="${GEMINI_URL:-}"
export GITHUB_TOKEN="${GITHUB_TOKEN:-}"
export GH_URL="${GH_URL:-}"
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
export OPENROUTER_URL="${OPENROUTER_URL:-}"
export DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}"
export DEEPSEEK_URL="${DEEPSEEK_URL:-}"

check_requirements() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed or not on PATH." >&2
    exit 1
  fi

  if ! node --version >/dev/null 2>&1; then
    echo "Unable to run node --version; check your Node installation." >&2
    exit 1
  fi

  if [[ ! -f "server.cjs" ]]; then
    echo "Missing server.cjs in the repository root." >&2
    exit 1
  fi
}

warn_missing_value() {
  local label="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "Warning: $label is not set." >&2
  fi
}

print_status() {
  warn_missing_value "GEMINI_API_KEY" "${GEMINI_API_KEY:-}"
  warn_missing_value "GITHUB_TOKEN" "${GITHUB_TOKEN:-}"
  warn_missing_value "OPENROUTER_API_KEY" "${OPENROUTER_API_KEY:-}"
  warn_missing_value "DEEPSEEK_API_KEY" "${DEEPSEEK_API_KEY:-}"
  warn_missing_value "GEMINI_URL" "${GEMINI_URL:-}"
  warn_missing_value "GH_URL" "${GH_URL:-}"
  warn_missing_value "OPENROUTER_URL" "${OPENROUTER_URL:-}"
  warn_missing_value "DEEPSEEK_URL" "${DEEPSEEK_URL:-}"
}

show_help() {
  cat <<'EOF'
Usage: bash scripts/node.sh [check|start|dev]

check  Validate the Node runtime and local files.
start  Run the Node proxy directly.
dev    Run the documented local startup flow via start.sh.
EOF
}

mode="${1:-dev}"

case "$mode" in
  check)
    check_requirements
    print_status
    echo "Node startup prerequisites are present."
    ;;
  start)
    check_requirements
    print_status
    exec node server.cjs
    ;;
  dev|restore)
    check_requirements
    print_status
    echo "Starting Node proxy via start.sh."
    exec bash start.sh
    ;;
  help|-h|--help)
    show_help
    ;;
  *)
    show_help >&2
    exit 1
    ;;
esac
