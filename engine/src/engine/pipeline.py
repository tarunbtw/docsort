"""Pipeline orchestrator: the single public entry point for all document processing.

Nothing outside this module should import extract, classify, llm_extract, or verify
directly. All callers (test scripts, FastAPI app) go through process_document().
"""

import logging
from pathlib import Path

from engine.classify import predict_relevance
from engine.extract import ScannedDocumentError, extract_text
from engine.llm_extract import LLMExtractionError, extract_structured
from engine.verify import verify_fields

logger = logging.getLogger(__name__)


def process_document(file_path: Path) -> dict:
    """Run the full pipeline on a single document and return the final result dict.

    Args:
        file_path: Path to the PDF document to process.

    Returns:
        A dict with at minimum a 'status' key:
        - {"status": "error", "error": "<message>"} on extraction failure.
        - {"status": "not_relevant", "confidence": <float>} if pre-filter rejects it.
        - {"status": "processed", "relevance_confidence": <float>, ...metadata...}
          on successful processing.
    """
    # Step 1: Extract text
    try:
        text = extract_text(file_path)
    except (ScannedDocumentError, FileNotFoundError, ValueError, OSError) as exc:
        logger.error("Text extraction failed for %s: %s", file_path, exc)
        return {"status": "error", "error": str(exc)}

    # Step 2: TF-IDF relevance pre-filter
    # This short-circuit is intentional: irrelevant documents never reach the LLM.
    try:
        is_relevant, confidence = predict_relevance(text)
    except RuntimeError as exc:
        logger.error("Classifier unavailable: %s", exc)
        return {"status": "error", "error": str(exc)}

    if not is_relevant:
        logger.info("Document %s classified as not relevant (%.3f)", file_path, confidence)
        return {"status": "not_relevant", "confidence": confidence}

    logger.info("Document %s is relevant (%.3f): proceeding to LLM extraction", file_path, confidence)

    # ── Step 3: LLM structured extraction ────────────────────────────────────
    try:
        extracted = extract_structured(text)
    except LLMExtractionError as exc:
        logger.error("LLM extraction failed for %s: %s", file_path, exc)
        return {"status": "error", "error": str(exc)}

    # ── Step 4: Verify verbatim fields against source text ───────────────────
    verified = verify_fields(extracted, text)

    # ── Step 5: Assemble final result ─────────────────────────────────────────
    return {
        "status": "processed",
        "relevance_confidence": confidence,
        **verified,
    }
