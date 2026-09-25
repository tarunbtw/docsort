#!/usr/bin/env bash
set -e

# Starts Python Engine (:8000), Go Backend (:8080), and React Frontend (:3000)


ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down DocSort services..."
  kill 0
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT


echo " Starting DocSort Full-Stack System"

# 1. Start Python ML Engine
echo "[1/3] Starting Python ML Engine on port 8000..."
cd "$ROOT_DIR/engine"
PYTHONPATH=src .venv/bin/uvicorn engine.api:app --host 127.0.0.1 --port 8000 &
cd "$ROOT_DIR"

# Wait 2 seconds for Python engine to initialize
sleep 2

# 2. Start Go Backend
echo "[2/3] Starting Go Backend on port 8080..."
cd "$ROOT_DIR/backend"
go run ./cmd/server &
cd "$ROOT_DIR"

# Wait 1 second for Go backend
sleep 1

# 3. Start React Frontend
echo "[3/3] Starting React Frontend on port 3000..."
cd "$ROOT_DIR/frontend"
npm run dev &
cd "$ROOT_DIR"


echo " All services running!"
echo " Frontend:  http://localhost:3000"
echo " Go API:    http://localhost:8080"
echo " ML Engine: http://localhost:8000"
echo " Press Ctrl+C to terminate all services"


wait
