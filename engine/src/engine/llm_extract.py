"""LLM-based structured metadata extraction using Groq.

One retry on JSON/validation failure before raising LLMExtractionError.
"""

import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq
from pydantic import BaseModel, ValidationError, field_validator

logger = logging.getLogger(__name__)

# Load .env from the engine root (two levels up from this file: src/engine/ → engine/).
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(_ENV_PATH)

# Single place to change the model — never scatter as magic strings.
_MODEL = "openai/gpt-oss-120b"

# Characters sent to the LLM are capped here to avoid 400 context-limit errors.
# The key verbatim fields (title, OM number, date, issuing authority) reliably
# appear in the header/lead section, so truncating the tail is an acceptable
# simplification. Cite this constant in the paper as a known limitation.
_MAX_INPUT_CHARS = 10_000

# Closed vocabulary for categories — LLM must choose from this list only.
ALLOWED_CATEGORIES = [
    "e-procurement",
    "tendering",
    "vendor-eligibility",
    "penalty",
    "GeM",
    "threshold-limits",
    "other",
]

_SYSTEM_PROMPT = f"""You are a structured data extractor for Indian government procurement documents.

Extract the following fields from the document text and respond with ONLY valid JSON — no prose, no markdown fences, no explanation.

Fields:
- title (string or null): exact title of the document, verbatim from the text
- date (string or null): date of the document, verbatim from the text
- issuing_authority (string or null): exact issuing authority name, verbatim from the text
- om_number (string or null): Office Memorandum number or reference number, verbatim from the text
- categories (array of strings): one or more categories from this fixed list only: {json.dumps(ALLOWED_CATEGORIES)}
- supersedes (string or null): any document this supersedes, verbatim from the text, or null
- summary (string): one sentence summarising the document, based only on the given text

Rules:
- For title, date, issuing_authority, om_number, supersedes: use the EXACT text as it appears in the document, or null if not present. Do NOT infer or guess.
- For categories: pick only from the allowed list above. Use "other" if nothing fits.
- For summary: one sentence, no more, derived only from the provided text.
- Output ONLY the JSON object. Nothing else."""


class ExtractedDocument(BaseModel):
    """Schema for LLM-extracted compliance metadata."""

    title: str | None
    date: str | None
    issuing_authority: str | None
    om_number: str | None
    categories: list[str]
    supersedes: str | None
    summary: str

    @field_validator("categories", mode="before")
    @classmethod
    def enforce_allowed_categories(cls, values: list) -> list[str]:
        """Filter out any category not in ALLOWED_CATEGORIES.

        Enforces the closed vocabulary in code so that LLM hallucinations
        (arbitrary strings outside the allowed list) are silently dropped
        rather than stored. Falls back to ['other'] if every value is invalid.
        """
        filtered = [v for v in values if v in ALLOWED_CATEGORIES]
        return filtered if filtered else ["other"]


class LLMExtractionError(Exception):
    """Raised when the LLM fails to return valid structured output after one retry."""


def _call_groq(client: Groq, text: str) -> str:
    """Send extraction prompt to Groq and return the raw response string.

    Args:
        client: Authenticated Groq client.
        text: Document text to extract from.

    Returns:
        Raw string content of the LLM's response.
    """
    response = client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0.0,  # Deterministic for extraction — no creativity needed.
    )
    return response.choices[0].message.content or ""


def _parse_and_validate(raw: str) -> ExtractedDocument:
    """Parse JSON string and validate against ExtractedDocument schema.

    Args:
        raw: Raw JSON string from the LLM.

    Returns:
        Validated ExtractedDocument instance.

    Raises:
        json.JSONDecodeError: If the string is not valid JSON.
        ValidationError: If the JSON does not match the schema.
    """
    data = json.loads(raw)
    return ExtractedDocument.model_validate(data)


def extract_structured(text: str) -> dict:
    """Call the LLM to extract structured compliance metadata from document text.

    Args:
        text: Full document text to analyse.

    Returns:
        Dict matching the ExtractedDocument schema, with 'verification_flags' absent
        (added downstream by verify.py).

    Raises:
        LLMExtractionError: If the LLM fails to return valid structured data after
                            one retry.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise LLMExtractionError(
            "GROQ_API_KEY is not set. Add it to engine/.env and do not commit it."
        )

    client = Groq(api_key=api_key)

    original_len = len(text)
    if original_len > _MAX_INPUT_CHARS:
        logger.warning(
            "Input text truncated from %d to %d characters before LLM call. "
            "Content beyond the limit is discarded.",
            original_len,
            _MAX_INPUT_CHARS,
        )
        text = text[:_MAX_INPUT_CHARS]

    for attempt in range(1, 3):  # Two attempts total: initial + one retry.
        try:
            raw = _call_groq(client, text)
            logger.debug("LLM raw response (attempt %d): %s", attempt, raw[:200])
            doc = _parse_and_validate(raw)
            return doc.model_dump()
        except (json.JSONDecodeError, ValidationError) as exc:
            # Malformed or schema-invalid response — retry once.
            logger.warning("Extraction attempt %d failed (parse/validation): %s", attempt, exc)
            if attempt == 2:
                raise LLMExtractionError(
                    f"LLM returned invalid data after {attempt} attempts. "
                    f"Last error: {exc}"
                ) from exc
            # Fall through to retry.
        except Exception as exc:  # noqa: BLE001
            # API-level failures: GroqError, rate limits, timeouts, connection drops.
            # These are not retryable by prompt change, but a single retry is worth
            # attempting for transient issues (e.g. brief timeout, rate-limit backoff).
            logger.warning("Extraction attempt %d failed (API error): %s", attempt, exc)
            if attempt == 2:
                raise LLMExtractionError(
                    f"Groq API error after {attempt} attempts. Last error: {exc}"
                ) from exc
            # Fall through to retry.

    # Unreachable — satisfies the type checker.
    raise LLMExtractionError("Unexpected exit from retry loop.")
