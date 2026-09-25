"""LLM-based structured metadata extraction using APMix AI (OpenAI and Anthropic compatible).

One retry on JSON/validation failure before raising LLMExtractionError.
"""

import json
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv
import httpx
from pydantic import BaseModel, ValidationError, field_validator

logger = logging.getLogger(__name__)

# Load .env from the engine root (two levels up from this file: src/engine/ -> engine/).
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(_ENV_PATH)

# Base URLs and model configuration
_BASE_URL = os.environ.get("APMIX_BASE_URL", "https://api.apmix.ai/v1").rstrip("/")
_ANTHROPIC_BASE_URL = os.environ.get("APMIX_ANTHROPIC_BASE_URL", "https://api.apmix.ai").rstrip("/")
_MODEL = os.environ.get("APMIX_MODEL", os.environ.get("LLM_MODEL", "claude-3-5-sonnet-20241022"))

# Characters sent to the LLM are capped here to avoid context limit errors.
# The key verbatim fields (title, OM number, date, issuing authority) reliably
# appear in the header/lead section, so truncating the tail is an acceptable simplification.
_MAX_INPUT_CHARS = 10_000

# Closed vocabulary for categories: LLM must choose from this list only.
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

Extract the following fields from the document text and respond with ONLY valid JSON: no prose, no markdown fences, no explanation.

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
    """Raised when the LLM fails to return valid structured output after retries."""


def _get_api_key() -> str:
    """Retrieve API key from environment variables."""
    api_key = (
        os.environ.get("APMIX_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )
    if not api_key:
        raise LLMExtractionError(
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
    # OpenAI format: choices[0].message.content
    if "choices" in data and len(data["choices"]) > 0:
        msg = data["choices"][0].get("message", {})
        content = msg.get("content")
        if content is not None:
            return content

    # Anthropic format: content[0].text
    if "content" in data and isinstance(data["content"], list) and len(data["content"]) > 0:
        first = data["content"][0]
        if isinstance(first, dict) and "text" in first:
            return first["text"]
        if isinstance(first, str):
            return first

    raise ValueError(f"Unrecognized response structure from LLM API: {list(data.keys())}")


def _call_apmix_openai(client: httpx.Client, api_key: str, text: str) -> str:
    """Call APMix using OpenAI-compatible chat completions endpoint."""
    url = f"{_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "temperature": 0.0,
    }
    resp = client.post(url, headers=headers, json=payload, timeout=60.0)
    resp.raise_for_status()
    return _extract_text_from_response(resp.json())


def _call_apmix_anthropic(client: httpx.Client, api_key: str, text: str) -> str:
    """Call APMix using Anthropic messages endpoint."""
    url = f"{_ANTHROPIC_BASE_URL}/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _MODEL,
        "system": _SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": text},
        ],
        "max_tokens": 1500,
        "temperature": 0.0,
    }
    resp = client.post(url, headers=headers, json=payload, timeout=60.0)
    resp.raise_for_status()
    return _extract_text_from_response(resp.json())


def _call_apmix(client: httpx.Client, text: str) -> str:
    """Route call to APMix based on configured mode with automatic fallback."""
    api_key = _get_api_key()
    mode = os.environ.get("APMIX_MODE", "").lower().strip()

    if mode == "anthropic":
        return _call_apmix_anthropic(client, api_key, text)

    # Default to OpenAI-compatible endpoint, falling back to Anthropic if 404 or unsupported
    try:
        return _call_apmix_openai(client, api_key, text)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (404, 405):
            logger.info("OpenAI endpoint returned %d, falling back to Anthropic endpoint", exc.response.status_code)
            return _call_apmix_anthropic(client, api_key, text)
        raise


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
    cleaned = _clean_json_str(raw)
    data = json.loads(cleaned)
    return ExtractedDocument.model_validate(data)


def extract_structured(text: str) -> dict:
    """Call the LLM to extract structured compliance metadata from document text.

    Args:
        text: Full document text to analyse.

    Returns:
        Dict matching the ExtractedDocument schema, with 'verification_flags' absent
        (added downstream by verify.py).

    Raises:
        LLMExtractionError: If the LLM fails to return valid structured data after retries.
    """
    _get_api_key()  # Fast fail if no key configured

    original_len = len(text)
    if original_len > _MAX_INPUT_CHARS:
        logger.warning(
            "Input text truncated from %d to %d characters before LLM call. "
            "Content beyond the limit is discarded.",
            original_len,
            _MAX_INPUT_CHARS,
        )
        text = text[:_MAX_INPUT_CHARS]

    with httpx.Client() as client:
        for attempt in range(1, 3):  # Two attempts total: initial + one retry
            try:
                raw = _call_apmix(client, text)
                logger.debug("LLM raw response (attempt %d): %s", attempt, raw[:200])
                doc = _parse_and_validate(raw)
                return doc.model_dump()
            except (json.JSONDecodeError, ValidationError) as exc:
                logger.warning("Extraction attempt %d failed (parse/validation): %s", attempt, exc)
                if attempt == 2:
                    raise LLMExtractionError(
                        f"LLM returned invalid data after {attempt} attempts. Last error: {exc}"
                    ) from exc
            except Exception as exc:  # noqa: BLE001
                logger.warning("Extraction attempt %d failed (API error): %s", attempt, exc)
                if attempt == 2:
                    raise LLMExtractionError(
                        f"APMix API error after {attempt} attempts. Last error: {exc}"
                    ) from exc

    raise LLMExtractionError("Unexpected exit from retry loop.")
