"""Text extraction from PDF documents.

OCR extension point: when ScannedDocumentError is raised, the caller could
pass the file to pytesseract (or similar) without any change to this module's
public signature, just handle that exception upstream.
"""

import logging
from pathlib import Path

import pdfplumber

logger = logging.getLogger(__name__)

# Documents shorter than this are almost certainly scanned / image-only.
_MIN_TEXT_LENGTH = 50


class ScannedDocumentError(Exception):
    """Raised when extracted text is too short to be a text-layer PDF.

    OCR (e.g. pytesseract) is the intended follow-up, not implemented yet.
    """


def extract_text(file_path: Path) -> str:
    """Extract raw text from a PDF file.

    Args:
        file_path: Absolute or relative path to the PDF.

    Returns:
        Full document text with pages joined by double newlines.

    Raises:
        FileNotFoundError: If the path does not exist.
        ValueError: If the file is not a PDF.
        ScannedDocumentError: If the PDF has no usable text layer.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if file_path.suffix.lower() != ".pdf":
        raise ValueError(
            f"Unsupported file type '{file_path.suffix}'. Only .pdf is accepted."
        )

    logger.debug("Extracting text from %s", file_path)

    with pdfplumber.open(file_path) as pdf:
        pages: list[str] = []
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            pages.append(page_text)

    text = "\n\n".join(pages).strip()

    if len(text) < _MIN_TEXT_LENGTH:
        # OCR (pytesseract) will be wired here in a future iteration.
        # The function signature stays identical: callers catch ScannedDocumentError.
        raise ScannedDocumentError(
            "Document appears to be scanned/image-based. OCR is not yet implemented."
        )

    logger.debug("Extracted %d characters from %s", len(text), file_path)
    return text
