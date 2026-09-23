"""Batch chunking + LLM auto-labeling for building the real TF-IDF training dataset.

Run from engine/ (or in Colab, with sys.path already pointing at src/):
    python build_dataset.py --pdf-dir sample_docs --out data/labeled_docs_auto.csv

Re-running the same command is safe: chunks already written to the output CSV are
skipped automatically, so a Colab disconnect or rate-limit interrupt can be resumed
by just running the same command again.

Splits each PDF into fixed-size text chunks, asks the LLM to judge relevance for
each chunk, and writes results to a CSV for human spot-check review. This is a
weak-supervision step — the output is NOT meant to be trusted as-is. Review a
sample, correct any wrong labels, then save the corrected file (columns: text,label
only — drop source_file/chunk_index) as data/labeled_docs.csv before running
train_classifier.py.

Rate-limit strategy:
    Groq free tier: 30 RPM / 1,000 RPD / 8,000 TPM — per model, per org.
    We rotate across _MODELS (3 models, each with its own separate quota bucket)
    so the effective daily ceiling is 3,000 requests. Sleep is 2 s between calls;
    since each model only receives 1 in every 3 calls, its effective inter-call
    gap is ~6 s — well within the 30 RPM cap.
    openai/gpt-oss-120b is intentionally excluded: that is llm_extract.py's quota.
"""

import argparse
import csv
import itertools
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import IO

from dotenv import load_dotenv
from groq import Groq
from pydantic import BaseModel, ValidationError

# Make the src layout importable regardless of cwd (same trick as test_pipeline.py).
sys.path.insert(0, str(Path(__file__).parent / "src"))

from engine.extract import ScannedDocumentError, extract_text  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(_ENV_PATH)

# Rotate across these models — each has its own separate quota on the Groq free tier.
# openai/gpt-oss-120b is excluded: that quota bucket belongs to llm_extract.py.
# Confirmed live as of 2026-09-23 (console.groq.com/docs/rate-limits):
#   llama-3.1-8b-instant        30 RPM / 14,400 RPD  ← primary workhorse
#   moonshotai/kimi-k2-instruct 60 RPM /  1,000 RPD
#   qwen/qwen3-32b              60 RPM /  1,000 RPD
# Effective daily ceiling with rotation: 16,400 RPD — far more than ~180 chunks need.
_MODELS = [
    "llama-3.1-8b-instant",
    "moonshotai/kimi-k2-instruct",
    "qwen/qwen3-32b",
]

_CHUNK_SIZE_CHARS = 1500
_MIN_CHUNK_CHARS = 200

# 2 s between calls. Each model only receives 1 in every 3 calls, so effective
# per-model gap is ~6 s → ~10 RPM per model, well within the 30 RPM free-tier cap.
_SLEEP_BETWEEN_CALLS = 2.0

_LABEL_PROMPT = """\
You are labeling text chunks for a dataset used to train a classifier that detects \
Indian government procurement/contract regulation documents (tenders, GeM, vendor \
eligibility, penalties, threshold limits, Office Memoranda on procurement policy).

Given the chunk of text below, decide if it is substantively about contract/procurement \
regulation or policy — not just a document that happens to be government-issued.

Respond with ONLY valid JSON, no prose:
{"is_relevant": true or false}"""


class _LabelResult(BaseModel):
    """Schema for the LLM's binary relevance judgment on one chunk."""

    is_relevant: bool


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


def label_chunk(client: Groq, chunk: str, model: str) -> bool | None:
    """Ask the LLM to judge whether a chunk is procurement-related.

    Args:
        client: Authenticated Groq client.
        chunk: Text chunk to label.
        model: Groq model ID to use for this call.

    Returns:
        True/False label, or None if the call/parse failed (chunk is skipped
        rather than given a guessed label).
    """
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _LABEL_PROMPT},
                {"role": "user", "content": chunk},
            ],
            temperature=0.0,
        )
        raw = response.choices[0].message.content or ""
        result = _LabelResult.model_validate(json.loads(raw))
        return result.is_relevant
    except (json.JSONDecodeError, ValidationError) as exc:
        logger.warning("Skipping chunk (model=%s) — invalid label response: %s", model, exc)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Skipping chunk (model=%s) — API error: %s", model, exc)
        return None


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
    client: Groq,
    pdf_path: Path,
    writer: "csv.writer[str]",
    f: IO[str],
    model_cycle: "itertools.cycle[str]",
    done_pairs: set[tuple[str, int]],
) -> tuple[int, int]:
    """Extract, chunk, label every chunk of a single PDF, and write rows immediately.

    Chunks already present in done_pairs are skipped without an API call.

    Args:
        client: Authenticated Groq client.
        pdf_path: Path to the PDF.
        writer: Open csv.writer to write each labeled row to as soon as it is ready.
        f: The underlying file object (used to flush after each row).
        model_cycle: Infinite iterator that yields the next model name to use.
        done_pairs: (source_file, chunk_index) pairs already written — skip these.

    Returns:
        Tuple of (n_relevant, n_total) counts for new rows written from this PDF.
        Returns (0, 0) if the PDF could not be extracted.
    """
    try:
        text = extract_text(pdf_path)
    except (ScannedDocumentError, FileNotFoundError, ValueError) as exc:
        logger.warning("Skipping %s — extraction failed: %s", pdf_path.name, exc)
        return 0, 0

    chunks = chunk_text(text)
    logger.info("%s: %d chunks total", pdf_path.name, len(chunks))

    n_relevant = 0
    n_total = 0
    for i, chunk in enumerate(chunks):
        if (pdf_path.name, i) in done_pairs:
            logger.debug("Skipping %s chunk %d — already labeled.", pdf_path.name, i)
            continue

        model = next(model_cycle)
        label = label_chunk(client, chunk, model)
        time.sleep(_SLEEP_BETWEEN_CALLS)

        if label is None:
            continue

        writer.writerow([pdf_path.name, i, chunk, int(label)])
        # Flush after every row — a crash or Colab disconnect loses nothing already written.
        f.flush()

        n_total += 1
        if label:
            n_relevant += 1

    return n_relevant, n_total


def main() -> None:
    """Chunk and auto-label every PDF in the given directory, write review CSV."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf-dir", type=Path, default=Path("sample_docs"))
    parser.add_argument("--out", type=Path, default=Path("data/labeled_docs_auto.csv"))
    args = parser.parse_args()

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")

    # max_retries=2 caps the SDK's own automatic retry so our exception handling
    # in label_chunk gets control quickly instead of waiting through long SDK loops.
    client = Groq(api_key=api_key, max_retries=2)

    pdf_files = sorted(args.pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {args.pdf_dir}.")
        return

    args.out.parent.mkdir(parents=True, exist_ok=True)

    # Resume: load any chunks already labeled so they are skipped this run.
    done_pairs = load_done_pairs(args.out)
    resuming = bool(done_pairs)
    if resuming:
        logger.info("Resuming — %d chunks already labeled, will skip those.", len(done_pairs))
    else:
        logger.info("Starting fresh run across %d PDFs.", len(pdf_files))

    model_cycle: itertools.cycle[str] = itertools.cycle(_MODELS)
    total_relevant = 0
    total_rows = 0

    # Append when resuming (preserve existing rows); write fresh otherwise.
    open_mode = "a" if resuming else "w"
    with args.out.open(open_mode, newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not resuming:
            writer.writerow(["source_file", "chunk_index", "text", "label"])
            f.flush()

        for pdf_path in pdf_files:
            n_relevant, n_total = process_pdf(
                client, pdf_path, writer, f, model_cycle, done_pairs
            )
            total_relevant += n_relevant
            total_rows += n_total

    print(f"\nWrote {total_rows} new labeled chunks to {args.out}")
    if resuming:
        print(f"  (+ {len(done_pairs)} chunks from previous run, already on disk)")
    print(f"  relevant: {total_relevant}, not_relevant: {total_rows - total_relevant}")
    print(
        "\nThis is auto-labeled (weak supervision) data. Review a sample before "
        "trusting it. Save the reviewed version as data/labeled_docs.csv with "
        "columns: text,label (drop source_file/chunk_index) before training."
    )


if __name__ == "__main__":
    main()
