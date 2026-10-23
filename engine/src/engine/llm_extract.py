"""LLM-based structured metadata extraction with multi-provider failover.

Documents are read in two passes:
  1. Header pass  - the leading context, for title/date/authority/OM number/
                    document type/categories/summary.
  2. Coverage pass - evenly sampled chunks from the remainder, looking only for
                    supersession references and an effective date. Trailing
                    annexures are where supersession clauses live, and they are
                    exactly what "proper compliance" depends on.

Providers come from LLM_PROVIDERS (see engine.providers); the first configured
provider that answers is used, and failures fall through to the next. The provider
that produced the result is returned as provenance.
"""

import json
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv
import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator

from engine.chunking import chunk_text, sample_evenly
from engine.providers import Provider, load_providers

logger = logging.getLogger(__name__)

# Load .env from the engine root (two levels up from this file: src/engine/ -> engine/).
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(_ENV_PATH)

# Closed vocabulary for topic categories: the model must choose from this list only.
ALLOWED_CATEGORIES = [
    "e-procurement",
    "tendering",
    "vendor-eligibility",
    "penalty",
    "GeM",
    "threshold-limits",
    "other",
]

# Closed vocabulary for the regulatory document kind.
ALLOWED_DOC_TYPES = [
    "Office Memorandum",
    "Circular",
    "Notification",
    "Order",
    "Policy",
    "Guidelines",
    "Manual",
    "Report",
    "Other",
]


def _lead_chars() -> int:
    """Characters of leading context sent in the header pass."""
    return int(os.environ.get("LLM_LEAD_CHARS", "10000"))


def _coverage_chunks() -> int:
    """Maximum chunks sampled from the remainder for the coverage pass."""
    return int(os.environ.get("LLM_COVERAGE_CHUNKS", "8"))


def _max_provider_passes() -> int:
    """How many times the full provider list may be cycled before giving up."""
    return int(os.environ.get("LLM_MAX_PASSES", "2"))


_HEADER_PROMPT = f"""You are a structured data extractor for Indian government procurement documents.

Extract the following fields from the document text and respond with ONLY valid JSON: no prose, no markdown fences, no explanation.

Fields:
- title (string or null): exact title of the document, verbatim from the text
- date (string or null): date of the document, verbatim from the text
- issuing_authority (string or null): exact issuing authority name, verbatim from the text
- om_number (string or null): Office Memorandum number or reference number, verbatim from the text
- doc_type (string): the kind of document, one of exactly: {json.dumps(ALLOWED_DOC_TYPES)}
- categories (array of strings): one or more categories from this fixed list only: {json.dumps(ALLOWED_CATEGORIES)}
- supersedes (string or null): any document this supersedes, verbatim from the text, or null
- summary (string): one sentence summarising the document, based only on the given text

Rules:
- For title, date, issuing_authority, om_number, supersedes: use the EXACT text as it appears in the document, or null if not present. Do NOT infer or guess.
- For om_number and supersedes, copy the reference character for character, keeping every dot, slash and hyphen, and keep the prefix where it stands ("No.F.1/112021-PPD" must not become "F. No. 1/11/2021-PPD"). If you cannot copy it exactly, return null.
- For doc_type: pick only from the allowed list above. Use "Other" if nothing fits.
- For categories: pick only from the allowed list above. Use "other" if nothing fits.
- For summary: one sentence, no more, derived only from the provided text.
- Output ONLY the JSON object. Nothing else."""

_COVERAGE_PROMPT = f"""You are scanning excerpts from the middle and end of an Indian government procurement document.

These excerpts are where supersession clauses and effective dates usually appear, far from the document header. Respond with ONLY valid JSON, no prose, no markdown fences.

Fields:
- superseded_documents (array of strings): identifiers of any earlier documents, orders, circulars or clauses that this excerpt says are superseded, cancelled, replaced or no longer in force. Copy the identifier VERBATIM as it appears. Empty array if none.
- date (string or null): an effective/issue date if one is stated verbatim in these excerpts, else null.

Rules:
- Do NOT summarise. Do NOT invent identifiers. Only report what is literally present.
- Output ONLY the JSON object. Nothing else."""


class ExtractedDocument(BaseModel):
    """Schema for the header pass."""

    title: str | None = None
    date: str | None = None
    issuing_authority: str | None = None
    om_number: str | None = None
    doc_type: str = "Other"
    categories: list[str] = Field(default_factory=list)
    supersedes: str | None = None
    summary: str = ""

    @field_validator("doc_type", mode="before")
    @classmethod
    def enforce_allowed_doc_type(cls, value: object) -> str:
        """Coerce any out-of-vocabulary document type to 'Other'."""
        return value if value in ALLOWED_DOC_TYPES else "Other"

    @field_validator("categories", mode="before")
    @classmethod
    def enforce_allowed_categories(cls, values: object) -> list[str]:
        """Filter out any category not in ALLOWED_CATEGORIES.

        Enforces the closed vocabulary in code so that model hallucinations
        (arbitrary strings outside the allowed list) are silently dropped
        rather than stored. Falls back to ['other'] if every value is invalid.
        """
        if not isinstance(values, list):
            return ["other"]
        filtered = [v for v in values if v in ALLOWED_CATEGORIES]
        return filtered if filtered else ["other"]


class _CoverageResult(BaseModel):
    """Schema for the coverage pass."""

    superseded_documents: list[str] = Field(default_factory=list)
    date: str | None = None

    @field_validator("superseded_documents", mode="before")
    @classmethod
    def clean_superseded(cls, values: object) -> list[str]:
        """Keep only non-empty string identifiers, de-duplicated."""
        if not isinstance(values, list):
            return []
        seen: list[str] = []
        for item in values:
            if isinstance(item, str) and item.strip() and item.strip() not in seen:
                seen.append(item.strip())
        return seen


class LLMExtractionError(Exception):
    """Raised when every configured provider fails to return valid structured output."""


class _ProviderUnavailable(Exception):
    """Raised when a provider is unusable (no key) or returned an error."""


def _clean_json_str(raw: str) -> str:
    """Extract valid JSON from raw LLM output, handling markdown code fences and commentary."""
    s = raw.strip()
    # Match markdown code fences: ```json { ... } ``` or ``` { ... } ```
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", s, flags=re.DOTALL | re.IGNORECASE)
    if fence_match:
        return fence_match.group(1).strip()

    # If raw string starts with or contains ``` without matching ending fence
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```$", "", s)
        return s.strip()

    # Extract outermost JSON object if there is conversational preamble/postscript
    obj_match = re.search(r"(\{.*\})", s, flags=re.DOTALL)
    if obj_match:
        return obj_match.group(1).strip()

    return s



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


def _call_provider(client: httpx.Client, provider: Provider, system: str, user: str) -> str:
    """Issue one request to a single provider.

    Args:
        client: httpx.Client (connection-pooled, caller-managed).
        provider: Provider to call.
        system: System prompt.
        user: User content.

    Returns:
        Raw response text.

    Raises:
        _ProviderUnavailable: If the provider has no key or returned an error.
    """
    api_key = provider.api_key()
    if not api_key:
        raise _ProviderUnavailable(f"{provider.name}: {provider.api_key_env} is not set")

    if provider.mode == "anthropic":
        url = f"{provider.base_url}/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": provider.model,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "max_tokens": 1500,
            "temperature": 0.0,
        }
    else:
        url = f"{provider.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": provider.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.0,
        }

    try:
        resp = client.post(url, headers=headers, json=payload, timeout=60.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise _ProviderUnavailable(f"{provider.name}: {exc}") from exc

    try:
        return _extract_text_from_response(resp.json())
    except (ValueError, json.JSONDecodeError) as exc:
        raise _ProviderUnavailable(f"{provider.name}: unusable response body: {exc}") from exc


def _extract_with_failover(
    client: httpx.Client,
    system: str,
    user: str,
    model_cls: type[BaseModel],
) -> tuple[BaseModel, Provider, int]:
    """Try every configured provider until one returns parseable structured output.

    Transport errors, missing keys, HTTP failures and unparseable output all move
    on to the next provider. The full list is cycled at most LLM_MAX_PASSES times.

    Args:
        client: httpx.Client (connection-pooled, caller-managed).
        system: System prompt.
        user: User content.
        model_cls: Pydantic model class to validate the response against.

    Returns:
        Tuple of (validated model instance, provider that answered, attempt count).

    Raises:
        LLMExtractionError: If no provider produced valid output.
    """
    providers = load_providers()
    last_error: Exception | None = None
    attempts = 0

    for pass_index in range(1, _max_provider_passes() + 1):
        for provider in providers:
            attempts += 1
            try:
                raw = _call_provider(client, provider, system, user)
                parsed = model_cls.model_validate(json.loads(_clean_json_str(raw)))
                if attempts > 1:
                    logger.info("Provider %s succeeded on attempt %d.", provider.name, attempts)
                return parsed, provider, attempts
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                logger.warning(
                    "Provider %s returned unparseable output (pass %d): %s",
                    provider.name, pass_index, exc,
                )
            except _ProviderUnavailable as exc:
                last_error = exc
                logger.warning("Provider %s unavailable (pass %d): %s", provider.name, pass_index, exc)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                logger.warning("Provider %s failed (pass %d): %s", provider.name, pass_index, exc)

    raise LLMExtractionError(
        f"All {len(providers)} provider(s) failed after {attempts} attempts. Last error: {last_error}"
    )


def extract_structured(text: str) -> dict:
    """Extract structured compliance metadata from document text.

    Runs a header pass over the leading context and a coverage pass over sampled
    chunks of the remainder to recover supersession references.

    Args:
        text: Full document text to analyse.

    Returns:
        Dict matching the ExtractedDocument schema plus:
        - superseded_documents: merged identifiers from both passes
        - extraction_provider / extraction_model / extraction_attempts: provenance
        - coverage_sourced_fields: fields the coverage pass supplied

    Raises:
        LLMExtractionError: If the header pass fails across every provider.
    """
    if not text or not text.strip():
        raise LLMExtractionError("Empty document text.")

    lead = text[: _lead_chars()]
    if len(text) > len(lead):
        logger.info(
            "Header pass on the first %d of %d characters; remainder handled by the coverage pass.",
            len(lead), len(text),
        )

    with httpx.Client() as client:
        header_doc, provider, attempts = _extract_with_failover(
            client, _HEADER_PROMPT, lead, ExtractedDocument
        )
        result = header_doc.model_dump()
        result["extraction_provider"] = provider.name
        result["extraction_model"] = provider.model
        result["extraction_attempts"] = attempts
        result["superseded_documents"] = []
        result["coverage_sourced_fields"] = []

        remainder = text[len(lead):]
        if remainder.strip():
            selected = sample_evenly(chunk_text(remainder), _coverage_chunks())
            coverage_input = "\n\n---\n\n".join(chunk for _, chunk in selected)
            try:
                coverage, _, _ = _extract_with_failover(
                    client, _COVERAGE_PROMPT, coverage_input, _CoverageResult
                )
            except LLMExtractionError as exc:
                # Coverage is best-effort: a header-only result is still useful.
                logger.warning("Coverage pass failed, continuing with header fields only: %s", exc)
            else:
                if coverage.superseded_documents:
                    result["superseded_documents"] = coverage.superseded_documents
                    result["coverage_sourced_fields"].append("superseded_documents")
                    if not result.get("supersedes"):
                        result["supersedes"] = coverage.superseded_documents[0]
                if coverage.date and not result.get("date"):
                    result["date"] = coverage.date
                    result["coverage_sourced_fields"].append("date")

    return result
