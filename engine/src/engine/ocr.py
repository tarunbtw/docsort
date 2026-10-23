"""OCR extraction module for scanned and image-based PDF documents.

Uses pypdfium2 to render PDF pages into PIL Images, and pytesseract (backed by
system Tesseract binary) to perform optical character recognition.
"""

from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path

import pypdfium2 as pdfium
import pytesseract

logger = logging.getLogger(__name__)

# Common default installation paths for Tesseract binary across platforms
_KNOWN_TESSERACT_PATHS = [
    "/opt/homebrew/bin/tesseract",  # macOS Apple Silicon (Homebrew)
    "/usr/local/bin/tesseract",     # macOS Intel (Homebrew) / Linux manual
    "/usr/bin/tesseract",           # Debian / Ubuntu apt
]

# Limit max pages processed by OCR to keep latency bounded
DEFAULT_OCR_MAX_PAGES = 15


def get_tesseract_path() -> str | None:
    """Locate the tesseract executable on the system."""
    env_path = os.environ.get("TESSERACT_CMD")
    if env_path and Path(env_path).is_file():
        return env_path

    which_path = shutil.which("tesseract")
    if which_path:
        return which_path

    for candidate in _KNOWN_TESSERACT_PATHS:
        if Path(candidate).is_file():
            return candidate

    return None


def is_ocr_available() -> bool:
    """Check if the OCR subsystem has a usable Tesseract binary."""
    return get_tesseract_path() is not None


def ocr_pdf(file_path: Path, max_pages: int | None = None) -> str:
    """Perform OCR on a PDF document by rendering pages to images.

    Args:
        file_path: Path to the PDF file.
        max_pages: Maximum number of pages to OCR. Defaults to OCR_MAX_PAGES env var or 15.

    Returns:
        Extracted text across pages joined by double newlines.

    Raises:
        FileNotFoundError: If file does not exist.
        RuntimeError: If Tesseract is not installed or available on the system.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    tesseract_cmd = get_tesseract_path()
    if not tesseract_cmd:
        raise RuntimeError(
            "Tesseract OCR is not installed or not found in system PATH. "
            "Install it via 'brew install tesseract' (macOS) or 'apt-get install tesseract-ocr' (Linux)."
        )

    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    if max_pages is None:
        max_pages = int(os.environ.get("OCR_MAX_PAGES", str(DEFAULT_OCR_MAX_PAGES)))

    logger.info("Starting OCR on %s (max_pages=%d) using %s", file_path.name, max_pages, tesseract_cmd)

    pdf = pdfium.PdfDocument(file_path)
    total_pages = len(pdf)
    pages_to_process = min(total_pages, max_pages) if max_pages > 0 else total_pages

    extracted_pages: list[str] = []

    for i in range(pages_to_process):
        try:
            page = pdf[i]
            # scale=2.0 renders at approx 144-150 DPI, ideal for OCR balance of speed and accuracy
            image = page.render(scale=2.0).to_pil()
            page_text = pytesseract.image_to_string(image)
            clean_text = page_text.strip()
            if clean_text:
                extracted_pages.append(clean_text)
            logger.debug("OCR page %d/%d extracted %d characters", i + 1, pages_to_process, len(clean_text))
        except Exception as exc:  # noqa: BLE001
            logger.warning("OCR failed on page %d of %s: %s", i + 1, file_path.name, exc)

    combined_text = "\n\n".join(extracted_pages).strip()
    logger.info(
        "Completed OCR on %s: extracted %d total characters across %d pages",
        file_path.name, len(combined_text), len(extracted_pages),
    )
    return combined_text
