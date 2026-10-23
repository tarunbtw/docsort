# DocSort

DocSort is a system for classifying regulatory public procurement documents and extracting verified compliance metadata. It uses a classical machine learning filter to separate procurement policies from general administrative circulars, followed by schema-constrained language model extraction and verbatim text verification.

## Architecture

The repository is structured into three primary services:

* **Engine (`engine/`)**: Python service providing digital and OCR text extraction, TF-IDF relevance triage, structured metadata extraction, and deterministic verbatim source verification.
* **Backend (`backend/`)**: Go service handling document storage, SQLite/PostgreSQL persistence, supersession tracking, and REST APIs.
* **Frontend (`frontend/`)**: React and TypeScript web interface for repository browsing, split-screen PDF preview, and compliance reviews.

## Repository Layout

```
docsort/
├── backend/          # Go API server and storage orchestration
├── engine/           # Python ML and extraction engine
├── frontend/         # React web client
├── docs/
│   ├── reports/      # Project reports and generation scripts
│   └── research/     # Research paper source, bibtex, and assets
└── start.sh          # Local orchestration script
```

## Prerequisites

* Python 3.12+
* Tesseract OCR (`brew install tesseract` on macOS or `apt-get install tesseract-ocr` on Linux)
* Go 1.22+
* Node.js 18+

## Quickstart

1. Configure environment variables:
   ```bash
   cp engine/.env.example engine/.env
   # Add your LLM provider key (e.g. GROQ_API_KEY) in engine/.env
   ```

2. Run the startup script:
   ```bash
   ./start.sh
   ```

Default service URLs:
* Frontend: http://localhost:3000
* Backend API: http://localhost:8080
* ML Engine: http://localhost:8000

## Running Services Individually

### Engine
```bash
cd engine
source .venv/bin/activate
PYTHONPATH=src uvicorn engine.api:app --port 8000
```

### Backend
```bash
cd backend
go run ./cmd/server
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Documentation

* Research paper source and LaTeX files: `docs/research/`
* Project reports and templates: `docs/reports/`
