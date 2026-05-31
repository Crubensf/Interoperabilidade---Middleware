#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

PORT="${MIDDLEWARE_PORT:-8080}"
exec python -m uvicorn app.main:app --reload --port "$PORT"
