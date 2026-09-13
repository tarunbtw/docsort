"""Manual smoke-test runner for the DocSort pipeline.

Run from engine/:
    python test_pipeline.py

Loops over every .pdf in sample_docs/, calls process_document(), and pretty-prints
the result. No test framework — results are verified by human inspection.
"""

import json
import logging
import sys
from pathlib import Path

# Ensure the src layout is importable when running this script directly.
sys.path.insert(0, str(Path(__file__).parent / "src"))

from engine.pipeline import process_document

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

_SAMPLE_DIR = Path(__file__).parent / "sample_docs"


def main() -> None:
    """Iterate over sample PDFs and print each pipeline result."""
    pdf_files = sorted(_SAMPLE_DIR.glob("*.pdf"))

    if not pdf_files:
        print(
            f"No PDF files found in {_SAMPLE_DIR}. "
            "Drop real sample documents there and re-run."
        )
        return

    for pdf_path in pdf_files:
        print(f"\n{'=' * 60}")
        print(f"Processing: {pdf_path.name}")
        print("=" * 60)

        result = process_document(pdf_path)
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
