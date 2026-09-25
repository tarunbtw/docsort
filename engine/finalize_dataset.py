"""Finalize the auto-labeled review CSV into the training dataset.

Run from engine/:
    python finalize_dataset.py

Reads data/labeled_docs_auto.csv (the review file written by build_dataset.py),
drops the review-only columns, optionally de-duplicates repeated passages, and
writes data/labeled_docs.csv with columns text,label — the format
train_classifier.py expects.

Prints the final class balance and a random sample for eyeball verification.
"""

import argparse
import csv
import logging
import random
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_ROOT = Path(__file__).parent
_LABEL_COLUMNS = ("source_file", "chunk_index", "text", "label", "confidence", "evidence")


def load_rows(csv_path: Path) -> list[dict[str, str]]:
    """Load review rows, keeping only fully-formed ones.

    Args:
        csv_path: Path to the review CSV.

    Returns:
        List of row dicts.

    Raises:
        FileNotFoundError: If the review CSV does not exist.
        ValueError: If required columns are missing.
    """
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Review CSV not found: {csv_path}. Run build_dataset.py first."
        )

    with csv_path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = {"text", "label"} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Review CSV is missing required columns: {missing}")
        rows = list(reader)

    return [r for r in rows if r.get("text") and r.get("label") in ("0", "1")]


def main() -> None:
    """Convert the review CSV into the text,label training CSV."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="in_path", type=Path, default=_ROOT / "data" / "labeled_docs_auto.csv")
    parser.add_argument("--out", dest="out_path", type=Path, default=_ROOT / "data" / "labeled_docs.csv")
    parser.add_argument("--min-confidence", type=float, default=0.6)
    parser.add_argument("--no-dedupe", action="store_true")
    parser.add_argument("--sample", type=int, default=20, help="Rows to print for spot-check.")
    args = parser.parse_args()

    rows = load_rows(args.in_path)
    logger.info("Loaded %d labeled rows from %s", len(rows), args.in_path)

    kept: list[dict[str, str]] = []
    seen: set[str] = set()
    dropped_conf = 0
    dropped_dup = 0

    for row in rows:
        try:
            confidence = float(row.get("confidence", "1.0"))
        except ValueError:
            confidence = 1.0
        if confidence < args.min_confidence:
            dropped_conf += 1
            continue

        key = " ".join(row["text"].split()).lower()
        if not args.no_dedupe:
            if key in seen:
                dropped_dup += 1
                continue
            seen.add(key)

        kept.append(row)

    args.out_path.parent.mkdir(parents=True, exist_ok=True)
    with args.out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text", "label"])
        for row in kept:
            writer.writerow([row["text"], row["label"]])

    relevant = sum(1 for r in kept if r["label"] == "1")
    not_relevant = len(kept) - relevant

    print(f"\nWrote {len(kept)} rows to {args.out_path}")
    print(f"  relevant: {relevant}, not_relevant: {not_relevant}")
    if dropped_conf:
        print(f"  dropped {dropped_conf} rows below confidence {args.min_confidence}")
    if dropped_dup:
        print(f"  dropped {dropped_dup} duplicate passages")
    if relevant and not_relevant:
        print(f"  class balance: {relevant / len(kept):.1%} relevant")

    if args.sample > 0 and kept:
        print(f"\n--- Random sample of {min(args.sample, len(kept))} rows ---")
        for row in random.sample(kept, min(args.sample, len(kept))):
            snippet = " ".join(row["text"].split())[:160]
            print(f"  [{row['label']}] {snippet}...")


if __name__ == "__main__":
    main()
