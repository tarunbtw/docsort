"""LLM provider registry with an explicit failover order.

Providers are configured as a JSON array in the LLM_PROVIDERS environment variable:

    LLM_PROVIDERS='[
      {"name":"groq","mode":"openai","base_url":"https://api.groq.com/openai/v1",
       "model":"llama-3.3-70b-versatile","api_key_env":"GROQ_API_KEY"},
      {"name":"gemini","mode":"openai",
       "base_url":"https://generativelanguage.googleapis.com/v1beta/openai",
       "model":"gemini-2.0-flash","api_key_env":"GEMINI_API_KEY"}
    ]'

Array order is failover order: the first provider that answers wins.

If LLM_PROVIDERS is unset, a single provider is synthesised from the legacy
APMIX_* variables so existing configurations keep working unchanged.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Ensure .env from engine root is loaded
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(_ENV_PATH)


DEFAULT_OPENAI_BASE_URL = "https://api.apmix.ai/v1"
DEFAULT_ANTHROPIC_BASE_URL = "https://api.apmix.ai"
DEFAULT_MODEL = "deepseek-v4-flash-free"

VALID_MODES = ("openai", "anthropic")


@dataclass(frozen=True)
class Provider:
    """One configured LLM endpoint."""

    name: str
    mode: str  # "openai" (/chat/completions) or "anthropic" (/v1/messages)
    base_url: str
    model: str
    api_key_env: str

    def api_key(self) -> str | None:
        """Resolve this provider's API key, falling back to the generic var."""
        key = os.environ.get(self.api_key_env)
        if key:
            return key
        generic = "ANTHROPIC_API_KEY" if self.mode == "anthropic" else "OPENAI_API_KEY"
        return os.environ.get(generic) or None


def _legacy_provider() -> Provider:
    """Build a single provider from the legacy APMIX_* variables."""
    mode = os.environ.get("APMIX_MODE", "").lower().strip()
    if mode not in VALID_MODES:
        mode = "openai"

    if mode == "anthropic":
        base_url = os.environ.get("APMIX_ANTHROPIC_BASE_URL") or DEFAULT_ANTHROPIC_BASE_URL
    else:
        base_url = os.environ.get("APMIX_BASE_URL") or DEFAULT_OPENAI_BASE_URL

    return Provider(
        name="apmix",
        mode=mode,
        base_url=base_url.rstrip("/"),
        model=os.environ.get("APMIX_MODEL") or os.environ.get("LLM_MODEL") or DEFAULT_MODEL,
        api_key_env="APMIX_API_KEY",
    )


def load_providers() -> list[Provider]:
    """Return the configured providers in failover order.

    Always returns at least one provider: an invalid or empty LLM_PROVIDERS value
    falls back to the legacy single-provider configuration.
    """
    raw = os.environ.get("LLM_PROVIDERS", "").strip()
    if not raw:
        return [_legacy_provider()]

    try:
        entries = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("LLM_PROVIDERS is not valid JSON (%s); using legacy provider.", exc)
        return [_legacy_provider()]

    if not isinstance(entries, list):
        logger.error("LLM_PROVIDERS must be a JSON array; using legacy provider.")
        return [_legacy_provider()]

    providers: list[Provider] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            logger.warning("LLM_PROVIDERS[%d] is not an object; skipping.", index)
            continue

        mode = str(entry.get("mode", "openai")).lower().strip()
        if mode not in VALID_MODES:
            logger.warning("LLM_PROVIDERS[%d] has unsupported mode %r; skipping.", index, mode)
            continue

        base_url = str(entry.get("base_url", "")).rstrip("/")
        model = str(entry.get("model", ""))
        if not base_url or not model:
            logger.warning("LLM_PROVIDERS[%d] is missing base_url or model; skipping.", index)
            continue

        providers.append(
            Provider(
                name=str(entry.get("name") or f"provider{index}"),
                mode=mode,
                base_url=base_url,
                model=model,
                api_key_env=str(entry.get("api_key_env") or "LLM_API_KEY"),
            )
        )

    if not providers:
        logger.error("No usable entries in LLM_PROVIDERS; using legacy provider.")
        return [_legacy_provider()]

    return providers
