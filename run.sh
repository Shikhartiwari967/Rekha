#!/usr/bin/env bash
# One-command dev runner for Rekha. Starts backend (:8000) and frontend (:5173).
# Use another backend port with: REKHA_PORT=8001 ./run.sh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${REKHA_PORT:-8000}"
export REKHA_API="http://localhost:$PORT"   # read by frontend/vite.config.js

# Windows has a fake `python3` (Microsoft Store stub), so test that it really runs.
if python3 --version >/dev/null 2>&1; then PY=python3; else PY=python; fi

echo "==> Setting up backend"
cd "$ROOT/backend"
[ -d .venv ] || "$PY" -m venv .venv
# venv layout differs: bin/ on Linux/macOS, Scripts/ on Windows.
if [ -f .venv/bin/activate ]; then source .venv/bin/activate; else source .venv/Scripts/activate; fi
python -m pip install -q -r requirements.txt
echo "==> Starting backend on http://localhost:$PORT"
# backend/.env holds passwords + REKHA_SECRET (template: backend/.env.example)
ENV_ARGS=(); [ -f .env ] && ENV_ARGS=(--env-file .env)
python -m uvicorn app:app --port "$PORT" "${ENV_ARGS[@]}" &
BACK=$!

echo "==> Setting up frontend"
cd "$ROOT/frontend"
npm install
echo "==> Starting frontend on http://localhost:5173"
npm run dev &
FRONT=$!

trap "kill $BACK $FRONT 2>/dev/null" EXIT
echo ""
echo "Rekha is live:"
echo "  Frontend  http://localhost:5173"
echo "  Backend   http://localhost:$PORT/docs"
echo "Press Ctrl+C to stop."
wait
