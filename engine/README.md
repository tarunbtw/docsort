# DocSort ML / NLP Processing Engine

The Python processing engine provides intelligent document triage, OCR, structured metadata extraction, and deterministic verbatim verification for regulatory compliance documents.

## Architecture

```
PDF Document
    │
    ▼
[Text Extraction & OCR Guard] (pdfplumber + pypdfium2 / pytesseract fallback)
    │
    ▼
[Stage 1: Relevance Classifier] (Sublinear TF-IDF + Logistic Regression, ~3.8 ms CPU)
    ├── Not Relevant (P < 0.5) ──► Segregated immediately (0 token cost, 0 API calls)
    └── Relevant (P >= 0.5)
            │
            ▼
[Stage 2: Constrained LLM Extraction] (Header Pass + Coverage Pass, Temperature 0.0)
    │
    ▼
[Stage 3: Deterministic Verbatim Verification] (Case & whitespace normalized substring matching)
    │
    ▼
Structured JSON Result with Provenance and Audit Flags
```

## Prerequisites & Installation

- Python 3.12+
- System Tesseract OCR:
  - **macOS**: `brew install tesseract`
  - **Linux (Ubuntu/Debian)**: `sudo apt-get install tesseract-ocr`

### Setup Virtual Environment

```bash
cd engine
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Running the Engine

Start the FastAPI HTTP service on port 8000:

```bash
PYTHONPATH=src .venv/bin/uvicorn engine.api:app --host 127.0.0.1 --port 8000
```

### Endpoints

- `GET /health`: Readiness probe and OCR capability verification.
- `POST /process`: Takes `{"file_path": "/absolute/path/to/doc.pdf"}` and returns full pipeline JSON.
- `POST /process/upload`: Multipart file upload for ad-hoc document processing.

## Dataset & Training Pipeline

1. **Download Primary Samples**:
   ```bash
   python download_samples.py
   ```
2. **Build Weak-Supervision Dataset**:
   ```bash
   python build_dataset.py --pdf-dir sample_docs --out data/labeled_docs_auto.csv
   ```
3. **Finalize & De-duplicate Dataset**:
   ```bash
   python finalize_dataset.py
   ```
4. **Train Relevance Classifier**:
   ```bash
   python train_classifier.py
   ```
5. **Leakage-Free Evaluation**:
   ```bash
   python evaluate_classifier.py
   ```

## Smoke Testing

To test the full pipeline against all PDFs in `sample_docs/`:

```bash
python test_pipeline.py
```
