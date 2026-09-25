"""FastAPI HTTP service for DocSort ML / NLP Engine.

Provides /process and /health endpoints for the Go backend and testing tools.
"""

import logging
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.pipeline import process_document

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DocSort ML Engine",
    description="Two-stage regulatory document triage and verifiable metadata extraction service.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessPathRequest(BaseModel):
    file_path: str


@app.get("/health")
def health_check():
    """Healthcheck endpoint to verify service readiness."""
    return {"status": "ok", "service": "docsort-ml-engine"}


@app.post("/process")
def process_by_path(req: ProcessPathRequest):
    """Run DocSort pipeline on a local file path."""
    path = Path(req.file_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")

    logger.info("Processing document from path: %s", path)
    result = process_document(path)
    return result


@app.post("/process/upload")
async def process_by_upload(file: UploadFile = File(...)):
    """Accept a multipart file upload, process it through DocSort, and clean up temporary storage."""
    suffix = Path(file.filename).suffix if file.filename else ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        logger.info("Processing uploaded document: %s (temp: %s)", file.filename, tmp_path)
        result = process_document(tmp_path)
        return result
    finally:
        if tmp_path.exists():
            os.unlink(tmp_path)
