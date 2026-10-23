"""Relevance classifier: wraps the trained TF-IDF + Logistic Regression pipeline.

The model is trained on ~1500-character chunks (see build_dataset.py), so at
inference the document is scored the same way - chunk by chunk - and the results
are aggregated. Scoring a 200-page manual as a single feature vector produced
misleading confidences, because one unusual page could decide the whole document.

The model is loaded lazily on first use so that importing this module at startup
incurs no I/O cost.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

import joblib
from dotenv import load_dotenv
from sklearn.pipeline import Pipeline

from engine.chunking import chunk_text

logger = logging.getLogger(__name__)

_ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(_ENV_PATH)

_MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "tfidf_lr.pkl"


# Module-level cache: populated on first call.
_pipeline: Pipeline | None = None


def _load_pipeline() -> Pipeline:
    """Load the trained pipeline from disk, caching it in the module.

    Returns:
        The loaded sklearn Pipeline.

    Raises:
        RuntimeError: If the .pkl file does not exist (run train_classifier.py first).
    """
    global _pipeline

    if _pipeline is not None:
        return _pipeline

    if not _MODEL_PATH.exists():
        raise RuntimeError(
            f"Model file not found at {_MODEL_PATH}. "
            "Run train_classifier.py first to generate it."
        )

    logger.debug("Loading classifier from %s", _MODEL_PATH)
    _pipeline = joblib.load(_MODEL_PATH)
    return _pipeline


def _relevant_probability(text: str) -> float:
    """Probability that a single chunk belongs to the procurement class."""
    pipeline = _load_pipeline()
    proba = pipeline.predict_proba([text])[0]
    classes = list(pipeline.named_steps["clf"].classes_)
    index = classes.index(1) if 1 in classes else len(classes) - 1
    return float(proba[index])


def _threshold(env_name: str, default: str) -> float:
    """Read a float threshold from the environment, falling back to a default."""
    return float(os.environ.get(env_name, default))


@dataclass
class RelevanceResult:
    """Aggregated relevance decision for one document.

    Attributes:
        is_relevant: Whether the document is treated as procurement-related.
        is_uncertain: True when the evidence is too weak to decide either way.
        confidence: Score backing the decision (meaning depends on the branch).
        n_chunks: Number of chunks the document was split into.
        frac_relevant: Fraction of chunks scored above 0.5.
        p_max: Highest single-chunk relevance probability.
        p_mean: Mean single-chunk relevance probability.
    """

    is_relevant: bool
    is_uncertain: bool
    confidence: float
    n_chunks: int
    frac_relevant: float
    p_max: float
    p_mean: float


def predict_document(text: str) -> RelevanceResult:
    """Decide whether a document concerns procurement/contract regulation.

    Chunks the text exactly as the training data was chunked, scores each chunk,
    and aggregates. A document is relevant when a meaningful share of its chunks
    look relevant, or when any single chunk is very confident; it is explicitly
    uncertain when the evidence is genuinely mixed.

    Args:
        text: Raw document text.

    Returns:
        A RelevanceResult describing the decision and the evidence behind it.

    Raises:
        RuntimeError: If the trained model file is missing.
    """
    chunks = chunk_text(text)
    if not chunks:
        # Too short to chunk (or empty): score it as a single unit.
        chunks = [text.strip() or " "]

    probs = [_relevant_probability(chunk) for chunk in chunks]
    p_max = max(probs)
    p_mean = sum(probs) / len(probs)
    frac_relevant = sum(1 for p in probs if p >= 0.5) / len(probs)

    relevant_frac = _threshold("RELEVANT_FRAC_THRESHOLD", "0.3")
    relevant_pmax = _threshold("RELEVANT_PMAX_THRESHOLD", "0.8")
    negative_pmax = _threshold("NEGATIVE_PMAX_THRESHOLD", "0.4")
    negative_frac = _threshold("NEGATIVE_FRAC_THRESHOLD", "0.1")

    if p_max >= relevant_pmax or frac_relevant >= relevant_frac:
        confidence = max(frac_relevant, p_max)
        result = RelevanceResult(True, False, confidence, len(probs), frac_relevant, p_max, p_mean)
    elif p_max < negative_pmax and frac_relevant < negative_frac:
        result = RelevanceResult(False, False, 1.0 - p_max, len(probs), frac_relevant, p_max, p_mean)
    else:
        result = RelevanceResult(False, True, p_max, len(probs), frac_relevant, p_max, p_mean)

    logger.debug(
        "Relevance: relevant=%s uncertain=%s chunks=%d frac=%.2f p_max=%.3f",
        result.is_relevant, result.is_uncertain, result.n_chunks, result.frac_relevant, result.p_max,
    )
    return result


def predict_relevance(text: str) -> tuple[bool, float]:
    """Backwards-compatible wrapper around predict_document.

    Args:
        text: Raw document text.

    Returns:
        Tuple of (is_relevant, confidence). Uncertain documents report as not relevant.
    """
    result = predict_document(text)
    return result.is_relevant, result.confidence
