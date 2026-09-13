"""Relevance classifier — wraps the trained TF-IDF + LR pipeline.

The model is loaded lazily on first use so that importing this module at
startup incurs no I/O cost if predict_relevance is never called.
"""

import logging
from pathlib import Path

import joblib
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)

_MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "tfidf_lr.pkl"

# Module-level cache — populated on first call to predict_relevance.
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


def predict_relevance(text: str) -> tuple[bool, float]:
    """Predict whether a document is procurement/contract-regulation related.

    Args:
        text: Raw document text (full or truncated).

    Returns:
        Tuple of (is_relevant, confidence_score) where confidence_score is the
        model's predicted probability for the predicted class.

    Raises:
        RuntimeError: If the trained model file is missing.
    """
    pipeline = _load_pipeline()

    # predict returns an array; we only ever score one document at a time.
    prediction: int = pipeline.predict([text])[0]
    # predict_proba returns [[prob_class0, prob_class1]]
    proba: float = float(pipeline.predict_proba([text])[0][prediction])

    is_relevant = bool(prediction == 1)
    logger.debug("Relevance prediction: %s (confidence %.3f)", is_relevant, proba)
    return is_relevant, proba
