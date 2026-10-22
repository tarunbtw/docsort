"""Document-level evaluation of the relevance classifier.

Run from engine/:
    python evaluate_classifier.py

train_classifier.py splits *chunks* at random, so chunks from the same document
land on both sides of the split and the reported scores are optimistic. This
script splits by *document* instead: whole documents are held out, which is the
only way to measure how the gate behaves on a circular it has never seen.

Reports both chunk-level and document-level metrics.
"""

import argparse
import csv
import logging
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from sklearn.metrics import classification_report  # noqa: E402
from sklearn.model_selection import GroupShuffleSplit  # noqa: E402

from engine.chunking import chunk_text  # noqa: E402
from train_classifier import build_pipeline  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_ROOT = Path(__file__).parent
_DEFAULT_IN = _ROOT / "data" / "labeled_docs_auto.csv"
_RANDOM_STATE = 42
_TEST_SIZE = 0.25
_RELEVANT_FRAC = 0.3


def load_rows(csv_path: Path) -> list[dict[str, str]]:
    """Load the review CSV, keeping rows that carry a source document and a label."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Review CSV not found: {csv_path}. Run build_dataset.py first.")

    with csv_path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = {"source_file", "text", "label"} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{csv_path} is missing required columns: {missing}")
        rows = [r for r in reader if r.get("text") and r.get("label") in ("0", "1")]
    return rows


def main() -> None:
    """Split by document, train, and report chunk- and document-level metrics."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="in_path", type=Path, default=_DEFAULT_IN)
    args = parser.parse_args()

    rows = load_rows(args.in_path)
    texts = [r["text"] for r in rows]
    labels = [int(r["label"]) for r in rows]
    groups = [r["source_file"] for r in rows]

    n_docs = len(set(groups))
    logger.info("Loaded %d chunks from %d documents", len(rows), n_docs)

    splitter = GroupShuffleSplit(n_splits=1, test_size=_TEST_SIZE, random_state=_RANDOM_STATE)
    train_idx, test_idx = next(splitter.split(texts, labels, groups))

    train_docs = {groups[i] for i in train_idx}
    test_docs = {groups[i] for i in test_idx}
    logger.info("Held-out documents (%d): %s", len(test_docs), ", ".join(sorted(test_docs)))
    logger.info("Training documents: %d", len(train_docs))

    pipeline = build_pipeline()
    pipeline.fit([texts[i] for i in train_idx], [labels[i] for i in train_idx])

    y_pred = pipeline.predict([texts[i] for i in test_idx])
    y_true = [labels[i] for i in test_idx]

    print("\n=== Chunk-level metrics (held-out documents only) ===")
    print(classification_report(y_true, y_pred, target_names=["not_relevant", "relevant"], zero_division=0))

    # Aggregate chunk predictions per held-out document.
    per_doc_pred: dict[str, list[int]] = defaultdict(list)
    per_doc_true: dict[str, int] = {}
    for idx, pred in zip(test_idx, y_pred):
        doc = groups[idx]
        per_doc_pred[doc].append(int(pred))
        per_doc_true.setdefault(doc, labels[idx])

    doc_true: list[int] = []
    doc_pred: list[int] = []
    for doc, preds in sorted(per_doc_pred.items()):
        frac_relevant = sum(preds) / len(preds)
        doc_true.append(per_doc_true[doc])
        doc_pred.append(1 if frac_relevant >= _RELEVANT_FRAC else 0)

    print(f"=== Document-level metrics ({len(doc_true)} held-out documents) ===")
    print(classification_report(doc_true, doc_pred, target_names=["not_relevant", "relevant"], zero_division=0))

    print("Per-document detail:")
    for doc, preds in sorted(per_doc_pred.items()):
        frac = sum(preds) / len(preds)
        verdict = "relevant" if frac >= _RELEVANT_FRAC else "not_relevant"
        truth = "relevant" if per_doc_true[doc] == 1 else "not_relevant"
        mark = "ok " if verdict == truth else "MISS"
        print(f"  {mark} {doc[:58]:58s} chunks={len(preds):3d} frac={frac:.2f} -> {verdict} (truth: {truth})")

    train_label_counts = Counter(labels[i] for i in train_idx)
    print(f"\nTrain class balance: {dict(train_label_counts)}")


if __name__ == "__main__":
    main()
