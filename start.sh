#!/usr/bin/env bash
set -e

# Starts Python Engine (:8000), Go Backend (:8080), and React Frontend (:3000),
# waiting for each service's health check before starting the next.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down DocSort services..."
  kill 0
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# wait_for <name> <url> <max_seconds>
wait_for() {
  local name="$1" url="$2" max="$3"
  local waited=0
  while [ "$waited" -lt "$max" ]; do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "  $name ready at $url"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  echo "  ERROR: $name did not become ready within ${max}s ($url)" >&2
  return 1
}

echo " Starting DocSort Full-Stack System"

# 1. Start Python ML Engine
echo "[1/3] Starting Python ML Engine on port 8000..."
cd "$ROOT_DIR/engine"
PYTHONPATH=src .venv/bin/uvicorn engine.api:app --host 127.0.0.1 --port 8000 &
cd "$ROOT_DIR"
wait_for "ML Engine" "http://127.0.0.1:8000/health" 60

# 2. Start Go Backend
echo "[2/3] Starting Go Backend on port 8080..."
cd "$ROOT_DIR/backend"
go run ./cmd/server &
cd "$ROOT_DIR"
wait_for "Go Backend" "http://127.0.0.1:8080/health" 90

# 3. Start React Frontend
echo "[3/3] Starting React Frontend on port 3000..."
cd "$ROOT_DIR/frontend"
npm run dev &
cd "$ROOT_DIR"
wait_for "Frontend" "http://127.0.0.1:3000/" 60

echo ""
echo " All services running!"
echo " Frontend:  http://localhost:3000"
echo " Go API:    http://localhost:8080"
echo " ML Engine: http://localhost:8000"
echo " Press Ctrl+C to terminate all services"

wait
