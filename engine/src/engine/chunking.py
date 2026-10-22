"""Shared paragraph-aware chunking.

Chunk boundaries are defined in exactly one place so that the units a classifier
is trained on match the units it is scored on at inference, and so that dataset
building, relevance scoring and map-reduce extraction all agree.
"""

from __future__ import annotations

CHUNK_SIZE_CHARS = 1500
MIN_CHUNK_CHARS = 200


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE_CHARS) -> list[str]:
    """Split text into roughly fixed-size chunks, breaking on paragraph boundaries.

    Args:
        text: Full document text.
        chunk_size: Target maximum characters per chunk.

    Returns:
        List of text chunks, each at or below chunk_size where possible, with
        chunks shorter than MIN_CHUNK_CHARS discarded.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current)
            current = para

    if current:
        chunks.append(current)

    return [c for c in chunks if len(c) >= MIN_CHUNK_CHARS]


def sample_evenly(items: list[str], n: int) -> list[tuple[int, str]]:
    """Pick at most n items spread evenly across the list.

    Used to keep extraction bounded on long manuals without only ever seeing the
    front matter.

    Args:
        items: Full list of chunks.
        n: Maximum number to keep (<= 0 means keep all).

    Returns:
        List of (original_index, chunk) pairs, preserving document order.
    """
    if n <= 0 or len(items) <= n:
        return list(enumerate(items))

    step = len(items) / n
    indices = sorted({int(i * step) for i in range(n)})
    return [(i, items[i]) for i in indices]
