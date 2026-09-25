"""Batch chunking and rule-based labeling for building the TF-IDF training dataset.

Run from engine/:
    python build_dataset.py --pdf-dir sample_docs --out data/labeled_docs_auto.csv

Re-running the same command is safe: chunks already written to the output CSV are
skipped automatically, so any interrupt can be resumed by running the command again.

Splits each PDF into paragraph-bounded chunks and labels each one with the
deterministic labeling-function ensemble in engine.label_rules. No LLM API and no
model are involved: labeling is offline, instant, and consumes no quota.

The output is weak-supervision data and should be spot-checked before use. Save the
reviewed version as data/labeled_docs.csv with columns text,label only (run
finalize_dataset.py to strip the review columns) before training.
"""

import argparse
import csv
import logging
import sys
from collections import Counter
from pathlib import Path
from typing import IO

# Make the src layout importable regardless of cwd.
sys.path.insert(0, str(Path(__file__).parent / "src"))

from engine.extract import ScannedDocumentError, extract_text  # noqa: E402
from engine.label_rules import classify  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_CHUNK_SIZE_CHARS = 1500
_MIN_CHUNK_CHARS = 200

# Cap chunks per PDF so one 300-page manual cannot dominate the dataset. Sampling
# is spread across the whole document rather than taking the first N (which would
# be table-of-contents front matter). 0 disables the cap.
_DEFAULT_MAX_CHUNKS_PER_PDF = 20

_MANIFEST_NAME = "_manifest.csv"


def chunk_text(text: str, chunk_size: int = _CHUNK_SIZE_CHARS) -> list[str]:
    """Split text into roughly fixed-size chunks, breaking on paragraph boundaries.

    Args:
        text: Full document text.
        chunk_size: Target maximum characters per chunk.

    Returns:
        List of text chunks, each at or below chunk_size where possible, with
        chunks shorter than _MIN_CHUNK_CHARS discarded.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current)
            current = para

    if current:
        chunks.append(current)

    return [c for c in chunks if len(c) >= _MIN_CHUNK_CHARS]


def sample_evenly(items: list[str], n: int) -> list[tuple[int, str]]:
    """Pick at most n items spread evenly across the list.

    Args:
        items: Full list of chunks.
        n: Maximum number to keep (<= 0 means keep all).

    Returns:
        List of (original_index, chunk) pairs, preserving document order.
    """
    if n <= 0 or len(items) <= n:
        return list(enumerate(items))

    step = len(items) / n
    indices = sorted({int(i * step) for i in range(n)})
    return [(i, items[i]) for i in indices]


def load_manifest(pdf_dir: Path) -> dict[str, str]:
    """Load filename -> source_class from the downloader's manifest, if present.

    Args:
        pdf_dir: Directory that may contain _manifest.csv.

    Returns:
        Mapping of PDF filename to 'relevant' / 'not_relevant'; empty if absent.
    """
    manifest = pdf_dir / _MANIFEST_NAME
    if not manifest.exists():
        return {}

    mapping: dict[str, str] = {}
    try:
        with manifest.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                mapping[row["filename"]] = row["source_class"]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read manifest %s: %s", manifest, exc)

    return mapping


def load_done_pairs(csv_path: Path) -> set[tuple[str, int]]:
    """Read an existing output CSV and return all (source_file, chunk_index) pairs.

    Used to resume an interrupted run: any pair already in the file is skipped
    so no duplicate rows are written on re-run.

    Args:
        csv_path: Path to the output CSV (may not exist yet).

    Returns:
        Set of (source_file, chunk_index) tuples already present in the file.
        Empty set if the file does not exist or is empty/unreadable.
    """
    if not csv_path.exists():
        return set()

    done: set[tuple[str, int]] = set()
    try:
        with csv_path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                done.add((row["source_file"], int(row["chunk_index"])))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read existing output CSV for resume: %s", exc)

    return done


def process_pdf(
    pdf_path: Path,
    writer: "csv.writer[str]",
    f: IO[str],
    done_pairs: set[tuple[str, int]],
    source_class: str | None,
    min_confidence: float,
    max_chunks: int,
    stats: Counter,
) -> tuple[int, int]:
    """Extract, chunk, and label every chunk of a PDF, writing rows immediately.

    Chunks already present in done_pairs are skipped. Abstained or low-confidence
    chunks are counted in stats but not written.

    Args:
        pdf_path: Path to the PDF.
        writer: Open csv.writer to write each labeled row as soon as it is ready.
        f: The underlying file object (used to flush after each row).
        done_pairs: (source_file, chunk_index) pairs already written: skip these.
        source_class: Document-level prior from the manifest, or None.
        min_confidence: Minimum label confidence required to keep a chunk.
        max_chunks: Cap on chunks per PDF (0 = unlimited).
        stats: Counter accumulating abstain/low-confidence/kept counts.

    Returns:
        Tuple of (n_relevant, n_not_relevant) rows written for this PDF.
        Returns (0, 0) if the PDF could not be extracted.
    """
    try:
        text = extract_text(pdf_path)
    except (ScannedDocumentError, FileNotFoundError, ValueError, OSError) as exc:
        logger.warning("Skipping %s: extraction failed: %s", pdf_path.name, exc)
        return 0, 0

    all_chunks = chunk_text(text)
    selected = sample_evenly(all_chunks, max_chunks)
    if len(selected) < len(all_chunks):
        logger.info(
            "%s: %d chunks, sampling %d evenly across the document.",
            pdf_path.name, len(all_chunks), len(selected),
        )
    else:
        logger.info("%s: %d chunks", pdf_path.name, len(selected))

    n_relevant = 0
    n_not_relevant = 0

    for index, chunk in selected:
        if (pdf_path.name, index) in done_pairs:
            continue

        result = classify(chunk, source_class=source_class)

        if result.label is None:
            stats["abstained"] += 1
            continue
        if result.confidence < min_confidence:
            stats["low_confidence"] += 1
            continue

        writer.writerow([
            pdf_path.name,
            index,
            chunk,
            result.label,
            f"{result.confidence:.3f}",
            ";".join(result.evidence),
        ])
        # Flush after every row: crashes or interrupts lose nothing already written.
        f.flush()

        for marker in result.evidence:
            stats[f"lf{marker}"] += 1

        if result.label == 1:
            n_relevant += 1
        else:
            n_not_relevant += 1

    return n_relevant, n_not_relevant


def _print_report(stats: Counter, total_relevant: int, total_not_relevant: int) -> None:
    """Print class balance, abstention rate, and the most frequently fired LFs."""
    total_rows = total_relevant + total_not_relevant
    abstained = stats["abstained"]
    low_conf = stats["low_confidence"]

    print("\n=== Labeling report (this run) ===")
    print(f"  rows written: relevant={total_relevant}, not_relevant={total_not_relevant}")
    print(f"  abstained (no strong LF): {abstained}")
    print(f"  dropped (confidence < threshold): {low_conf}")

    considered = total_rows + abstained + low_conf
    if considered:
        print(f"  abstain rate: {abstained / considered:.1%} of {considered} chunks")
    if total_rows and min(total_relevant, total_not_relevant) / total_rows < 0.2:
        print("  WARNING: one class is under 20% of rows — consider more sources of the minority class.")

    firings = sorted(
        ((name[2:], count) for name, count in stats.items() if name.startswith("lf")),
        key=lambda kv: kv[1],
        reverse=True,
    )
    if firings:
        print("\n  top labeling-function firings (chunks matched):")
        for name, count in firings[:15]:
            print(f"    {name}: {count}")


def main() -> None:
    """Chunk and label every PDF in the given directory, write the review CSV."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf-dir", type=Path, default=Path("sample_docs"))
    parser.add_argument("--out", type=Path, default=Path("data/labeled_docs_auto.csv"))
    parser.add_argument("--min-confidence", type=float, default=0.6)
    parser.add_argument("--max-chunks-per-pdf", type=int, default=_DEFAULT_MAX_CHUNKS_PER_PDF)
    args = parser.parse_args()

    pdf_files = sorted(args.pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {args.pdf_dir}.")
        return

    manifest = load_manifest(args.pdf_dir)
    if manifest:
        logger.info("Loaded source-class priors for %d files from manifest.", len(manifest))
    else:
        logger.info("No manifest found — labeling without document-level priors.")

    args.out.parent.mkdir(parents=True, exist_ok=True)

    # Resume: load any chunks already labeled so they are skipped this run.
    done_pairs = load_done_pairs(args.out)
    resuming = bool(done_pairs)
    if resuming:
        logger.info("Resuming: %d chunks already labeled, skipping those.", len(done_pairs))
    else:
        logger.info("Starting fresh labeling run across %d PDFs.", len(pdf_files))

    stats: Counter = Counter()
    total_relevant = 0
    total_not_relevant = 0

    open_mode = "a" if resuming else "w"
    with args.out.open(open_mode, newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not resuming:
            writer.writerow(
                ["source_file", "chunk_index", "text", "label", "confidence", "evidence"]
            )
            f.flush()

        for pdf_path in pdf_files:
            n_rel, n_non = process_pdf(
                pdf_path,
                writer,
                f,
                done_pairs,
                manifest.get(pdf_path.name),
                args.min_confidence,
                args.max_chunks_per_pdf,
                stats,
            )
            total_relevant += n_rel
            total_not_relevant += n_non

    print(f"\nWrote {total_relevant + total_not_relevant} new labeled chunks to {args.out}")
    if resuming:
        print(f"  (+ {len(done_pairs)} chunks from previous run, already on disk)")
    _print_report(stats, total_relevant, total_not_relevant)
    print(
        "\nThis is weak-supervision data. Spot-check a sample, then run "
        "finalize_dataset.py to produce data/labeled_docs.csv (text,label)."
    )


if __name__ == "__main__":
    main()
