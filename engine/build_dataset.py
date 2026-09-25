"""Batch chunking and LLM auto-labeling for building the real TF-IDF training dataset.

Run from engine/:
    python build_dataset.py --pdf-dir sample_docs --out data/labeled_docs_auto.csv

Re-running the same command is safe: chunks already written to the output CSV are
skipped automatically, so any interrupt can be resumed by running the command again.

Splits each PDF into fixed-size text chunks, asks the LLM to judge relevance for
each chunk, and writes results to a CSV for human spot-check review. This is a
weak-supervision step: the output is reviewed to correct wrong labels, then saved
(columns: text,label only) as data/labeled_docs.csv before running train_classifier.py.

API: APMix AI — https://api.apmix.ai/v1
Model: deepseek-v4-flash-free
Key: set APMIX_API_KEY in engine/.env
"""

import argparse
import csv
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import IO

from dotenv import load_dotenv
import httpx
from pydantic import BaseModel, ValidationError

# Make the src layout importable regardless of cwd.
sys.path.insert(0, str(Path(__file__).parent / "src"))

from engine.extract import ScannedDocumentError, extract_text  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(_ENV_PATH)

# APMix AI endpoint and model — single place to change these.
_BASE_URL = "https://api.apmix.ai/v1"
_MODEL = "gpt-6-luna-free"
_FALLBACK_MODEL = "deepseek-v4-flash-free"  # tried once if _MODEL exhausts all retries

_CHUNK_SIZE_CHARS = 1500
_MIN_CHUNK_CHARS = 200

# Pause between calls to remain well within provider rate limits.
_SLEEP_BETWEEN_CALLS = 1.0

_LABEL_PROMPT = (
    "You are labeling text chunks for a dataset used to train a classifier that detects "
    "Indian government procurement/contract regulation documents (tenders, GeM, vendor "
    "eligibility, penalties, threshold limits, Office Memoranda on procurement policy).\n\n"
    "Given the chunk of text below, decide if it is substantively about contract/procurement "
    "regulation or policy, not just a document that happens to be government-issued.\n\n"
    'Respond with ONLY valid JSON, no prose:\n{"is_relevant": true or false}'
)


class _LabelResult(BaseModel):
    """Schema for the LLM's binary relevance judgment on one chunk."""

    is_relevant: bool


def _get_api_key() -> str:
    """Retrieve API key from environment variables."""
    api_key = (
        os.environ.get("APMIX_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )
    if not api_key:
        raise RuntimeError(
            "APMIX_API_KEY is not set. Add it to engine/.env and do not commit it."
        )
    return api_key


def _clean_json_str(raw: str) -> str:
    """Strip markdown code block fences and whitespace from raw LLM output."""
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _extract_text_from_response(data: dict) -> str:
    """Extract response text from either OpenAI or Anthropic response format."""
    if "choices" in data and len(data["choices"]) > 0:
        msg = data["choices"][0].get("message", {})
        content = msg.get("content")
        if content is not None:
            return content

    if "content" in data and isinstance(data["content"], list) and len(data["content"]) > 0:
        first = data["content"][0]
        if isinstance(first, dict) and "text" in first:
            return first["text"]
        if isinstance(first, str):
            return first

    raise ValueError(f"Unrecognized response structure from LLM API: {list(data.keys())}")


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


# HTTP status codes that are transient — worth retrying after a wait.
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}

# Backoff delays in seconds between retry attempts (3 total attempts).
_RETRY_DELAYS = [10.0, 30.0]


def label_chunk(client: httpx.Client, api_key: str, chunk: str) -> bool | None:
    """Ask the LLM to judge whether a chunk is procurement-related.

    Retries on transient server errors (503, 429, timeout) with backoff before
    giving up and skipping the chunk. Permanent errors (bad JSON, 401, etc.)
    skip immediately without retry.

    Args:
        client: httpx.Client session.
        api_key: APMix API key.
        chunk: Text chunk to label.

    Returns:
        True/False label, or None if all attempts failed (chunk is skipped).
    """
    delays = [None] + _RETRY_DELAYS  # first attempt has no pre-delay
    last_exc: Exception | None = None

    for attempt, delay in enumerate(delays, start=1):
        if delay is not None:
            logger.info(
                "Transient error — waiting %ds before retry (attempt %d/%d)...",
                int(delay), attempt, len(delays),
            )
            time.sleep(delay)

        try:
            resp = client.post(
                f"{_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": _MODEL,
                    "messages": [
                        {"role": "system", "content": _LABEL_PROMPT},
                        {"role": "user", "content": chunk},
                    ],
                    "temperature": 0.0,
                },
                timeout=45.0,
            )
            # Raise immediately only for non-retryable HTTP errors.
            if resp.status_code in _RETRYABLE_STATUS:
                last_exc = httpx.HTTPStatusError(
                    f"HTTP {resp.status_code}", request=resp.request, response=resp
                )
                continue  # retry

            resp.raise_for_status()
            raw = _extract_text_from_response(resp.json())
            cleaned = _clean_json_str(raw)
            result = _LabelResult.model_validate(json.loads(cleaned))
            return result.is_relevant

        except httpx.TimeoutException as exc:
            last_exc = exc
            continue  # retry timeouts

        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in _RETRYABLE_STATUS:
                last_exc = exc
                continue  # retry
            # Non-retryable HTTP error (400, 401, 403 …) — skip immediately.
            logger.warning(
                "Skipping chunk (model=%s): HTTP %d: %s",
                _MODEL, exc.response.status_code, exc,
            )
            return None

        except (json.JSONDecodeError, ValidationError) as exc:
            # Bad JSON from LLM — no point retrying the same input.
            logger.warning("Skipping chunk (model=%s): invalid label response: %s", _MODEL, exc)
            return None

        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            continue  # retry unknown errors once

    logger.warning(
        "Primary model %s failed after %d attempts (last error: %s) — trying fallback %s.",
        _MODEL, len(delays), last_exc, _FALLBACK_MODEL,
    )
    try:
        resp = client.post(
            f"{_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": _FALLBACK_MODEL,
                "messages": [
                    {"role": "system", "content": _LABEL_PROMPT},
                    {"role": "user", "content": chunk},
                ],
                "temperature": 0.0,
            },
            timeout=45.0,
        )
        resp.raise_for_status()
        raw = _extract_text_from_response(resp.json())
        cleaned = _clean_json_str(raw)
        result = _LabelResult.model_validate(json.loads(cleaned))
        return result.is_relevant
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Skipping chunk: fallback model %s also failed: %s",
            _FALLBACK_MODEL, exc,
        )
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
    client: httpx.Client,
    api_key: str,
    pdf_path: Path,
    writer: "csv.writer[str]",
    f: IO[str],
    done_pairs: set[tuple[str, int]],
) -> tuple[int, int]:
    """Extract, chunk, label every chunk of a single PDF, and write rows immediately.

    Chunks already present in done_pairs are skipped without an API call.

    Args:
        client: httpx.Client session.
        api_key: APMix API key.
        pdf_path: Path to the PDF.
        writer: Open csv.writer to write each labeled row to as soon as it is ready.
        f: The underlying file object (used to flush after each row).
        done_pairs: (source_file, chunk_index) pairs already written: skip these.

    Returns:
        Tuple of (n_relevant, n_total) counts for new rows written from this PDF.
        Returns (0, 0) if the PDF could not be extracted.
    """
    try:
        text = extract_text(pdf_path)
    except (ScannedDocumentError, FileNotFoundError, ValueError) as exc:
        logger.warning("Skipping %s: extraction failed: %s", pdf_path.name, exc)
        return 0, 0

    chunks = chunk_text(text)
    logger.info("%s: %d chunks total", pdf_path.name, len(chunks))

    n_relevant = 0
    n_total = 0
    for i, chunk in enumerate(chunks):
        if (pdf_path.name, i) in done_pairs:
            logger.debug("Skipping %s chunk %d: already labeled.", pdf_path.name, i)
            continue

        label = label_chunk(client, api_key, chunk)
        time.sleep(_SLEEP_BETWEEN_CALLS)

        if label is None:
            continue

        writer.writerow([pdf_path.name, i, chunk, int(label)])
        # Flush after every row: crashes or interrupts lose nothing already written.
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

    api_key = _get_api_key()

    pdf_files = sorted(args.pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {args.pdf_dir}.")
        return

    args.out.parent.mkdir(parents=True, exist_ok=True)

    # Resume: load any chunks already labeled so they are skipped this run.
    done_pairs = load_done_pairs(args.out)
    resuming = bool(done_pairs)
    if resuming:
        logger.info("Resuming: %d chunks already labeled, skipping those.", len(done_pairs))
    else:
        logger.info("Starting fresh run across %d PDFs using model: %s", len(pdf_files), _MODEL)

    total_relevant = 0
    total_rows = 0

    open_mode = "a" if resuming else "w"
    with httpx.Client() as client:
        with args.out.open(open_mode, newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not resuming:
                writer.writerow(["source_file", "chunk_index", "text", "label"])
                f.flush()

            for pdf_path in pdf_files:
                n_relevant, n_total = process_pdf(
                    client, api_key, pdf_path, writer, f, done_pairs
                )
                total_relevant += n_relevant
                total_rows += n_total

    print(f"\nWrote {total_rows} new labeled chunks to {args.out}")
    if resuming:
        print(f"  (+ {len(done_pairs)} chunks from previous run, already on disk)")
    print(f"  relevant: {total_relevant}, not_relevant: {total_rows - total_relevant}")
    print(
        "\nThis is auto-labeled data. Review a sample before trusting it. "
        "Save the reviewed version as data/labeled_docs.csv with columns: "
        "text,label (drop source_file/chunk_index) before training."
    )


if __name__ == "__main__":
    main()
