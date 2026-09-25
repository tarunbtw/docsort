"""Verification layer: confirms that verbatim-extracted fields appear in source text.

Flags any field whose value cannot be found in the source, without modifying
the extracted values themselves. Flagging is the only action: no silent correction.
"""

import logging
import re

logger = logging.getLogger(__name__)

# Fields that are supposed to be verbatim extractions and are therefore verifiable.
_VERBATIM_FIELDS = ("title", "date", "issuing_authority", "om_number", "supersedes")


def _normalise(text: str) -> str:
    """Collapse all whitespace runs to a single space and strip edges.

    Args:
        text: Raw string.

    Returns:
        Whitespace-normalised, lowercased string.
    """
    return re.sub(r"\s+", " ", text).strip().lower()


def verify_fields(extracted: dict, source_text: str) -> dict:
    """Check that verbatim-extracted fields actually appear in the source text.

    Args:
        extracted: Dict produced by llm_extract.extract_structured (or equivalent).
        source_text: The original document text the LLM was given.

    Returns:
        The input dict with an added 'verification_flags' key, containing a list of field
        names whose values could NOT be confirmed in source_text. Empty list means
        all checks passed.
    """
    normalised_source = _normalise(source_text)
    flags: list[str] = []

    for field in _VERBATIM_FIELDS:
        value = extracted.get(field)
        if value is None:
            # Null means "not found in document": nothing to verify.
            continue

        if _normalise(str(value)) not in normalised_source:
            logger.warning(
                "Field '%s' value %r not found in source text: flagging.", field, value
            )
            flags.append(field)

    result = dict(extracted)
    result["verification_flags"] = flags
    return result
