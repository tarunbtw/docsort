"""Verification layer: confirms that verbatim-extracted fields appear in source text.

Flags any field whose value cannot be found in the source, without modifying
the extracted values themselves. Flagging is the only action: no silent correction.

Two allowances keep the check useful rather than noisy:

* Reference numbers (``om_number``, supersession references) are compared with
  their marker tokens (``No.``, ``F.``, ``Ref``, ...) removed, because models
  routinely reorder them (``F. No. 1/11/2021-PPD`` vs ``No.F.1/112021-PPD``).
  The distinguishing digits and letters must still be present.
* Supersession evidence is reported once. ``supersedes`` is derived from the first
  entry of ``superseded_documents``, so flagging both would count one problem twice.
"""

import logging
import re

logger = logging.getLogger(__name__)

# Fields that are supposed to be verbatim extractions and are therefore verifiable.
_VERBATIM_FIELDS = ("title", "date", "issuing_authority", "om_number")

# Fields that hold official reference numbers, compared reference-aware.
_REFERENCE_FIELDS = ("om_number", "supersedes")

# Marker tokens that carry no distinguishing information in a reference number.
_REF_MARKER_RE = re.compile(r"\b(?:f|no|ref|om|dated)\b\.?", re.IGNORECASE)


def _normalise(text: str) -> str:
    """Collapse all whitespace runs to a single space and strip edges.

    Args:
        text: Raw string.

    Returns:
        Whitespace-normalised, lowercased string.
    """
    return re.sub(r"\s+", " ", text).strip().lower()


def _normalise_loose(text: str) -> str:
    """Reduce a string to lowercase alphanumerics only.

    Official reference numbers are punctuated inconsistently between the issuing
    document and the extracted value (``F.1/11/2021-PPD`` vs ``F 1 11 2021 PPD``),
    so a punctuation-insensitive comparison avoids flagging correct extractions.
    """
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _normalise_ref(text: str) -> str:
    """Canonical form of a reference number, with marker tokens removed.

    ``No.F.1/112021-PPD`` and ``F. No. 1/11/2021-PPD`` both reduce to
    ``1112021ppd``, while the distinguishing digits and suffix are preserved.
    """
    return _normalise_loose(_REF_MARKER_RE.sub(" ", text))


def _is_grounded(value: str, normalised_source: str, loose_source: str) -> bool:
    """Whether a value can be located in the source text under either text comparison."""
    if _normalise(value) in normalised_source:
        return True
    return _normalise_loose(value) in loose_source


def _is_reference_grounded(value: str, loose_source: str, ref_source: str) -> bool:
    """Whether a reference number can be located in the source text.

    Falls back to the marker-stripped comparison so that reformatting of the
    ``No.``/``F.No.`` prefix does not read as a hallucination. The distinguishing
    digits and letters must still appear in the source.
    """
    if _normalise_loose(value) in loose_source:
        return True

    canonical = _normalise_ref(value)
    if not canonical:
        # Nothing but markers: there is no distinctive content to verify.
        return True
    return canonical in ref_source


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
    loose_source = _normalise_loose(source_text)
    ref_source = _normalise_ref(source_text)
    flags: list[str] = []

    for field in _VERBATIM_FIELDS:
        value = extracted.get(field)
        if value is None:
            # Null means "not found in document": nothing to verify.
            continue

        if field in _REFERENCE_FIELDS:
            grounded = _is_reference_grounded(str(value), loose_source, ref_source)
        else:
            grounded = _is_grounded(str(value), normalised_source, loose_source)

        if not grounded:
            logger.warning(
                "Field '%s' value %r not found in source text: flagging.", field, value
            )
            flags.append(field)

    # Supersession references drive compliance links, so an ungrounded reference
    # is worse than a missing one. All supersession evidence is reported as a
    # single flag, since `supersedes` is derived from `superseded_documents[0]`.
    evidence: list[str] = [str(r) for r in (extracted.get("superseded_documents") or []) if r]
    supersedes = extracted.get("supersedes")
    if supersedes and str(supersedes) not in evidence:
        evidence.append(str(supersedes))

    ungrounded = [ref for ref in evidence if not _is_reference_grounded(ref, loose_source, ref_source)]
    if ungrounded:
        logger.warning("Ungrounded supersession references: %r", ungrounded)
        if "supersedes" not in flags:
            flags.append("supersedes")

    result = dict(extracted)
    result["verification_flags"] = flags
    return result
