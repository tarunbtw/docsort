"""Train the TF-IDF + Logistic Regression relevance classifier.

NOTE: The CSV at data/labeled_docs.csv currently contains DUMMY synthetic examples
only. This dummy data MUST be replaced with a real, human-labeled dataset before
the classification metrics reported here are meaningful for a paper evaluation.

Run:
    python train_classifier.py
"""

import logging
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Resolve paths relative to this file so the script works from any cwd.
_ROOT = Path(__file__).parent
_DATA_PATH = _ROOT / "data" / "labeled_docs.csv"
_MODEL_PATH = _ROOT / "models" / "tfidf_lr.pkl"

_RANDOM_STATE = 42
_TEST_SIZE = 0.2


def load_data(csv_path: Path) -> tuple[list[str], list[int]]:
    """Load texts and labels from the CSV file.

    Args:
        csv_path: Path to labeled_docs.csv (columns: text, label).

    Returns:
        Tuple of (texts, labels).

    Raises:
        FileNotFoundError: If the CSV does not exist.
        ValueError: If required columns are missing.
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"Training data not found: {csv_path}")

    df = pd.read_csv(csv_path)

    missing = {"text", "label"} - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    return df["text"].tolist(), df["label"].tolist()


def build_pipeline() -> Pipeline:
    """Construct the sklearn Pipeline (TF-IDF → Logistic Regression).

    Returns:
        An unfitted sklearn Pipeline.
    """
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    max_features=10_000,
                    sublinear_tf=True,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=1000,
                    random_state=_RANDOM_STATE,
                ),
            ),
        ]
    )


def train_and_evaluate(texts: list[str], labels: list[int]) -> Pipeline:
    """Split data, fit the pipeline, and print a classification report.

    Args:
        texts: List of document text strings.
        labels: Corresponding 0/1 relevance labels.

    Returns:
        The fitted pipeline.
    """
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=_TEST_SIZE, random_state=_RANDOM_STATE
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    # Printed clearly so results can be pasted into the paper's evaluation section.
    print("\n=== Classification Report (test split) ===")
    print(classification_report(y_test, y_pred, target_names=["not_relevant", "relevant"]))

    return pipeline


def save_model(pipeline: Pipeline, model_path: Path) -> None:
    """Persist the fitted pipeline to disk.

    Args:
        pipeline: Fitted sklearn Pipeline.
        model_path: Destination path for the .pkl file.
    """
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_path)
    logger.info("Model saved to %s", model_path)


if __name__ == "__main__":
    logger.info("Loading training data from %s", _DATA_PATH)
    texts, labels = load_data(_DATA_PATH)
    logger.info("Loaded %d examples", len(texts))

    pipeline = train_and_evaluate(texts, labels)
    save_model(pipeline, _MODEL_PATH)
