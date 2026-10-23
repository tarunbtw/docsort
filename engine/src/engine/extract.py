"""Text extraction from PDF documents with integrated OCR fallback.

Extracts native text using pdfplumber, falling back to Tesseract OCR via pypdfium2
when a document has no usable text layer (scanned or image-based).
"""

import logging
from pathlib import Path

import pdfplumber

from engine.ocr import is_ocr_available, ocr_pdf

logger = logging.getLogger(__name__)

# Documents yielding fewer characters than this are treated as scanned/image-only.
_MIN_TEXT_LENGTH = 50


class ScannedDocumentError(Exception):
    """Raised when extracted text is too short and OCR could not produce readable text."""


def extract_text(file_path: Path) -> str:
    """Extract raw text from a PDF file with automatic OCR fallback.

    Args:
        file_path: Absolute or relative path to the PDF.

    Returns:
        Full document text with pages joined by double newlines.

    Raises:
        FileNotFoundError: If the path does not exist.
        ValueError: If the file is not a PDF.
        ScannedDocumentError: If neither digital extraction nor OCR produced usable text.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if file_path.suffix.lower() != ".pdf":
        raise ValueError(
            f"Unsupported file type '{file_path.suffix}'. Only .pdf is accepted."
        )

    logger.debug("Extracting digital text from %s", file_path)

    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            pages: list[str] = []
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                pages.append(page_text)
        text = "\n\n".join(pages).strip()
    except Exception as exc:
        logger.warning("Digital text extraction failed on %s: %s; trying OCR.", file_path, exc)

    if len(text) < _MIN_TEXT_LENGTH:
        logger.info(
            "Document %s has insufficient digital text (%d chars). Falling back to OCR...",
            file_path.name,
            len(text),
        )

        if not is_ocr_available():
            raise ScannedDocumentError(
                "Document appears to be scanned/image-based, but Tesseract OCR is not installed. "
                "Install it via 'brew install tesseract' (macOS) or 'apt-get install tesseract-ocr' (Linux)."
            )

        try:
            ocr_text = ocr_pdf(file_path)
            if len(ocr_text) >= _MIN_TEXT_LENGTH:
                logger.info(
                    "OCR successfully recovered %d characters for %s",
                    len(ocr_text),
                    file_path.name,
                )
                return ocr_text
        except Exception as exc:
            logger.error("OCR execution failed for %s: %s", file_path, exc)
            raise ScannedDocumentError(f"Scanned document OCR failed: {exc}") from exc

        raise ScannedDocumentError(
            f"Document appears to be scanned/image-based, and OCR extracted insufficient text "
            f"({len(ocr_text) if 'ocr_text' in locals() else 0} characters)."
        )

    logger.debug("Extracted %d characters from %s", len(text), file_path)
    return text

