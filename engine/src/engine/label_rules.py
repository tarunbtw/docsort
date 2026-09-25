"""Deterministic, dependency-free labeling functions for weak supervision.

Replaces the remote LLM judgments previously used by build_dataset.py: every
chunk is scored by a weighted ensemble of keyword and regex heuristics, so the
dataset can be regenerated offline, instantly, and without any API quota.

The design follows the labeling-function paradigm (Ratner et al., Snorkel;
Mintz et al., distant supervision): several noisy, independent LFs vote, a
weighted score decides the label, and chunks where no LF fires strongly enough
are ABSTAINED rather than guessed at.

Public API:
    classify(chunk, source_class=None) -> LFResult
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Decision threshold on the weighted margin (procurement score - admin score).
# |margin| < TAU => abstain.
TAU = 1.0

# Weight added per polarity based on the document the chunk came from. This acts
# as a document-level labeling function: a chunk from a non-procurement source
# with no procurement evidence at all is still a valid negative example.
_SOURCE_PRIOR = 1.0

# Strong = unambiguous procurement/contract language; medium = suggestive.
_PROCUREMENT_TERMS: dict[str, float] = {
    # -- strong (1.0) --
    "procurement": 1.0,
    "procuring": 1.0,
    "procuring entity": 1.0,
    "procurement policy": 1.0,
    "tender": 1.0,
    "tenders": 1.0,
    "tendering": 1.0,
    "bidder": 1.0,
    "bidders": 1.0,
    "bidding": 1.0,
    "e-procurement": 1.0,
    "eprocurement": 1.0,
    "government e-marketplace": 1.0,
    "gem": 1.0,
    "earnest money": 1.0,
    "bid security": 1.0,
    "performance security": 1.0,
    "rate contract": 1.0,
    "limited tender": 1.0,
    "open tender": 1.0,
    "technical bid": 1.0,
    "financial bid": 1.0,
    "bid evaluation": 1.0,
    "vendor eligibility": 1.0,
    "request for proposal": 1.0,
    "gfr": 1.0,
    "general financial rules": 1.0,
    "central vigilance": 1.0,
    "purchase order": 1.0,
    "e-publishing": 1.0,
    "dgs&d": 1.0,
    # -- medium (0.5-0.8) --
    "emd": 0.8,
    "cvc": 0.8,
    "cppp": 0.8,
    "expression of interest": 0.8,
    "eligibility criteria": 0.8,
    "liquidated damages": 0.8,
    "breach of contract": 0.8,
    "threshold limit": 0.8,
    "supply order": 0.6,
    "blacklist": 0.6,
    "vendor": 0.6,
    "vendors": 0.6,
    "consignee": 0.6,
    "turnover": 0.6,
    "rfp": 0.6,
    "contract": 0.5,
    "contracts": 0.5,
    "contractor": 0.5,
    "purchase": 0.5,
    "purchases": 0.5,
    "quotation": 0.5,
    "penalty": 0.5,
    "penalties": 0.5,
    "bid": 0.5,
    "bids": 0.5,
    "supplier": 0.5,
    "suppliers": 0.5,
    "tenderer": 0.5,
    "eoi": 0.4,
    "lakh": 0.3,
    "crore": 0.3,
    "inr": 0.3,
}

# Administrative / HR / academic language: a signal of the negative class.
_ADMIN_TERMS: dict[str, float] = {
    "holiday": 1.0,
    "holidays": 1.0,
    "gazetted holiday": 1.0,
    "public holiday": 1.0,
    "canteen": 0.8,
    "picnic": 0.8,
    "seniority": 0.8,
    "syllabus": 0.8,
    "annual property return": 0.8,
    "table of contents": 0.8,
    "pay scale": 0.7,
    "distribution list": 0.7,
    "transfer": 0.6,
    "transfers": 0.6,
    "posting": 0.6,
    "attendance": 0.6,
    "recruitment": 0.6,
    "admission": 0.6,
    "festival": 0.6,
    "promotion": 0.6,
    "curriculum": 0.6,
    "scholarship": 0.6,
    "deputation": 0.6,
    "leave": 0.5,
    "examination": 0.5,
    "welfare": 0.5,
    "pension": 0.5,
    "recreation": 0.5,
    "academic": 0.4,
    "appointment": 0.4,
    "reservation": 0.4,
    "annexure": 0.4,
    "medical": 0.3,
    "university": 0.3,
    "index": 0.3,
    # Academic / education vocabulary (UGC-style negatives).
    "degree": 0.5,
    "degrees": 0.5,
    "faculty": 0.5,
    "student": 0.4,
    "students": 0.4,
    "teacher": 0.4,
    "teachers": 0.4,
    "college": 0.4,
    "colleges": 0.4,
    "course": 0.4,
    "courses": 0.4,
    "semester": 0.4,
    "education": 0.3,
    "educational": 0.3,
    "higher education": 0.4,
    "research": 0.4,
    "programme": 0.2,
    "hostel": 0.3,
    # HR / establishment vocabulary.
    "civil list": 0.8,
    "cadre": 0.5,
    "vacancy": 0.4,
    "roster": 0.4,
    "allowance": 0.4,
    "dearness allowance": 0.6,
    "pay commission": 0.6,
    "allowances": 0.4,
    "workplace": 0.5,
    "harassment": 0.6,
    "complaint": 0.3,
    "disciplinary": 0.3,
    "establishment officer": 0.5,
}

# Regex LFs: structural markers that keyword lists miss.
_PROCUREMENT_PATTERNS: list[tuple[re.Pattern[str], float, str]] = [
    (
        re.compile(r"\b(above|up\s*to|beyond|exceeding|not\s+exceeding)\s*(₹|rs\.?|inr)?\s*[\d.,]+\s*(lakh|lakhs|crore|crores)\b", re.I),
        0.8,
        "amount-threshold",
    ),
    (re.compile(r"\bwithout\s+competitive\s+bidding\b", re.I), 1.0, "no-competitive-bidding"),
    (re.compile(r"\b(gem|government\s+e-?marketplace)\b", re.I), 0.8, "gem-portal"),
    (re.compile(r"\b(e-?procurement|eprocure|e-?publishing|central\s+public\s+procurement\s+portal)\b", re.I), 0.8, "eprocurement"),
    (re.compile(r"\b(office\s+memorandum|o\.?m\.?\s+no)\b", re.I), 0.3, "office-memorandum"),
    (re.compile(r"\b(bid\s+(security|document|opening|submission)|pre-?bid|two-?bid|single-?bid)\b", re.I), 0.8, "bid-process"),
    (re.compile(r"\b(purchase\s+preference|make\s+in\s+india|public\s+procurement)\b", re.I), 0.7, "procurement-policy"),
]

_ADMIN_PATTERNS: list[tuple[re.Pattern[str], float, str]] = [
    (re.compile(r"\b(list\s+of\s+holidays|holiday\s+list|closed\s+holiday)\b", re.I), 1.0, "holiday-list"),
    (re.compile(r"\b(central\s+government\s+offices|offices\s+shall\s+remain\s+closed)\b", re.I), 0.6, "office-closure"),
]


def _term_pattern(term: str) -> re.Pattern[str]:
    """Build a case-insensitive word-boundary pattern for a lexicon term."""
    return re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)


_PROCUREMENT_RES: list[tuple[re.Pattern[str], float, str]] = [
    (_term_pattern(t), w, t) for t, w in _PROCUREMENT_TERMS.items()
]
_ADMIN_RES: list[tuple[re.Pattern[str], float, str]] = [
    (_term_pattern(t), w, t) for t, w in _ADMIN_TERMS.items()
]


@dataclass
class LFResult:
    """Outcome of scoring one chunk with the labeling-function ensemble.

    Attributes:
        label: 1 (relevant), 0 (not relevant), or None (abstain).
        confidence: 0.0 for abstain, else 0.5-1.0 rising with the decision margin.
        score: Raw weighted margin (procurement - admin), including source prior.
        evidence: Matched markers, prefixed '+' (procurement) or '-' (admin).
    """

    label: int | None
    confidence: float
    score: float
    evidence: list[str] = field(default_factory=list)


def _score(text: str) -> tuple[float, float, list[str]]:
    """Return (procurement_score, admin_score, evidence) for a chunk of text."""
    pro = 0.0
    adm = 0.0
    evidence: list[str] = []

    for pattern, weight, name in _PROCUREMENT_RES:
        if pattern.search(text):
            pro += weight
            evidence.append(f"+{name}")

    for pattern, weight, name in _ADMIN_RES:
        if pattern.search(text):
            adm += weight
            evidence.append(f"-{name}")

    for pattern, weight, name in _PROCUREMENT_PATTERNS:
        if pattern.search(text):
            pro += weight
            evidence.append(f"+{name}")

    for pattern, weight, name in _ADMIN_PATTERNS:
        if pattern.search(text):
            adm += weight
            evidence.append(f"-{name}")

    return pro, adm, evidence


def classify(chunk: str, source_class: str | None = None) -> LFResult:
    """Label a text chunk as procurement-relevant, non-relevant, or abstain.

    Args:
        chunk: Text passage to label.
        source_class: Optional document-level prior ('relevant' or
            'not_relevant'), used to nudge borderline chunks.

    Returns:
        An LFResult; label is None when the ensemble is not confident enough.
    """
    if not chunk or not chunk.strip():
        return LFResult(label=None, confidence=0.0, score=0.0, evidence=[])

    pro, adm, evidence = _score(chunk)

    prior = 0.0
    if source_class == "relevant":
        prior = _SOURCE_PRIOR
    elif source_class == "not_relevant":
        prior = -_SOURCE_PRIOR

    margin = (pro - adm) + prior

    if margin >= TAU:
        label = 1
    elif margin <= -TAU:
        label = 0
    else:
        return LFResult(label=None, confidence=0.0, score=margin, evidence=evidence)

    # Confidence rises from ~0.5 at the threshold toward 1.0 as the margin grows.
    confidence = 0.5 + 0.5 * min(1.0, (abs(margin) - TAU) / (2 * TAU))
    return LFResult(label=label, confidence=confidence, score=margin, evidence=evidence)
