"""Acquire the DocSort corpus of real Indian government PDFs into sample_docs/.

Run from engine/:
    python download_samples.py

Two-tier sourcing:
  1. Curated seeds (_RELEVANT / _NOT_RELEVANT) — hand-picked, known-good URLs.
  2. Listing-page crawl (_CRAWL_TARGETS) — discover .pdf links from official
     index pages, following same-authority links one level deep.

Downloads are streamed to disk, validated as PDFs, deduped by content hash, and
retried with backoff (government portals frequently reset connections). A sidecar
manifest (sample_docs/_manifest.csv) records filename -> source class so the
labeler can apply a weak document-level prior. Failures land in _failed.txt.

Safe to re-run: existing files are skipped, so this only fills gaps.
"""

import argparse
import csv
import hashlib
import logging
import random
import re
import time
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import httpx

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# httpx logs every request at INFO, which drowns our own progress messages.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

_OUT_DIR = Path(__file__).parent / "sample_docs"
_TIMEOUT_SECONDS = 60.0
_SLEEP_BETWEEN_DOWNLOADS = 1.0
_MANIFEST_NAME = "_manifest.csv"

# Keep the working corpus small: 10 relevant + 10 non-relevant = 20 documents.
_DEFAULT_MAX_PER_CLASS = 10
_MAX_ATTEMPTS = 3
_BACKOFF_BASE = 2.0  # seconds; delays are 2s, 4s plus jitter

# Some government servers reject requests with no User-Agent header or a
# non-browser one, so rotate through a small pool of realistic agents.
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
]

_ACCEPT = "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8"

# Only follow/download links on Indian government domains.
_GOV_SUFFIXES = (".gov.in", ".nic.in")

_HREF_RE = re.compile(r"""href\s*=\s*["']([^"']+)["']""", re.IGNORECASE)


# --------------------------------------------------------------------------- #
# Curated seeds
# --------------------------------------------------------------------------- #

# Real Indian government procurement/contract regulation documents (label 1).
_RELEVANT = [
    "https://doe.gov.in/files/procurement-policy-division/Push_Button_Procurement_0.pdf",
    "https://doe.gov.in/files/circulars_document/GeM_through_PFMS_non_PFMS_Agencies_Entities_NPAE_reg_1_0.pdf",
    "https://doe.gov.in/files/procurement-policy-division/RelaxNorms_StarupMedEnterprise25072016.pdf",
    "https://doe.gov.in/files/procurement-policy-division/Department_of_Public_Enterprises_circular.pdf",
    "https://doe.gov.in/files/circulars_document/MfPoCS_2025.pdf",
    "https://doe.gov.in/files/circulars_document/MfPoNCS_2025.pdf",
    "https://doe.gov.in/files/circulars_document/Works_Manual_SE_2025.pdf",
    "https://doe.gov.in/files/circulars_document/Manual_Goods_2024.pdf",
    "https://doe.gov.in/files/circulars_document/Draft_Works_Manual_2nd_Edition.pdf",
    "https://doe.gov.in/files/manuals_documents/Manual_for_Procurement_of_Goods_Updated%20June,%202022.pdf",
]

# Real government documents that are NOT procurement-related (label 0).
_NOT_RELEVANT = [
    "https://www.ugc.gov.in/pdfnews/3045759_Draft-Regulation-Minimum-Qualifications-for-Appointment-and-Promotion-of-Teachers-and-Academic-Staff-in-Universities-and-Colleges-and-Measures-for-the-Maintenance-of-Standards-in-HE-Regulations-2025.pdf",
    "https://www.ugc.gov.in/pdfnews/7039866_UGC-Letter-Draft-Regulation-and-Guidelines.pdf",
    "https://dopt.gov.in/sites/default/files/Holiday%20list%20(1).pdf",
    "https://dopt.gov.in/sites/default/files/Holidays%20to%20be%20observed%20in%20Central%20Government%20Offices%20during%20the%20year%202026.pdf",
    "https://documents.doptcirculars.nic.in/D2/D02est/Holidays%20to%20be%20observed%20in%20Central%20Government%20Offices%20during%20the%20year%2020265vgBs.pdf",
    "https://dfe.gov.in/uploads/documents/list-of-gazetted-holidays-2026.pdf",
]

_SEEDS: dict[str, str] = {
    **{u: "relevant" for u in _RELEVANT},
    **{u: "not_relevant" for u in _NOT_RELEVANT},
}

# Listing/index pages to crawl. Failures are non-fatal: a page that 404s or is
# JS-rendered contributes nothing and we fall back to the curated seeds.
_CRAWL_TARGETS = [
    ("https://doe.gov.in/", "relevant"),
    ("https://doe.gov.in/procurement-policy-division", "relevant"),
    ("https://doe.gov.in/circulars", "relevant"),
    ("https://doe.gov.in/manuals", "relevant"),
    ("https://www.ugc.gov.in/", "not_relevant"),
    ("https://dopt.gov.in/", "not_relevant"),
    ("https://dopt.gov.in/circulars", "not_relevant"),
]

# Filename keywords used to infer the class of pre-existing (undocumented) PDFs.
_RELEVANT_NAME_HINTS = (
    "procure", "tender", "gem", "works_manual", "manual_goods", "pfms", "contract", "gfr",
)
_NOT_RELEVANT_NAME_HINTS = ("holiday", "ugc", "leave", "transfer", "canteen", "calendar")


def _filename_from_url(url: str) -> str:
    """Derive a clean, filesystem-safe local filename from a URL."""
    raw = unquote(Path(urlparse(url).path).name)
    safe = re.sub(r"[^A-Za-z0-9._() -]", "_", raw).strip()
    if not safe.lower().endswith(".pdf"):
        safe = f"{safe or 'document'}.pdf"
    return safe


def _is_pdf_url(url: str) -> bool:
    """True if the URL path points at a PDF (ignoring query/fragment)."""
    return urlparse(url).path.lower().endswith(".pdf")


def _is_gov_url(url: str) -> bool:
    """True if the URL host is on `.gov.in` or `.nic.in`."""
    host = (urlparse(url).hostname or "").lower()
    return host.endswith(_GOV_SUFFIXES)


def _headers() -> dict[str, str]:
    """Fresh browser-like headers with a rotated User-Agent."""
    return {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": _ACCEPT,
        "Accept-Language": "en-IN,en;q=0.9",
    }


def _fetch_page(client: httpx.Client, url: str) -> str | None:
    """Fetch an HTML listing page, returning its text or None on failure."""
    try:
        resp = client.get(url, headers=_headers(), timeout=_TIMEOUT_SECONDS, follow_redirects=True)
        resp.raise_for_status()
        if "html" not in resp.headers.get("content-type", "").lower():
            return None
        return resp.text
    except httpx.HTTPError as exc:
        logger.warning("Could not fetch listing page %s: %s", url, exc)
        return None


def discover_pdfs(
    client: httpx.Client,
    page_url: str,
    depth: int = 1,
    max_pages: int = 15,
    max_pdfs: int = 40,
) -> list[str]:
    """Discover PDF URLs linked from a listing page, one level deep.

    Args:
        client: httpx.Client instance.
        page_url: The listing page to start from.
        depth: How many link hops to follow within the same authority.
        max_pages: Cap on pages fetched (guards against runaway crawls).
        max_pdfs: Cap on PDFs returned.

    Returns:
        Deduplicated list of absolute PDF URLs on government domains.
    """
    seen_pages: set[str] = set()
    pdfs: list[str] = []
    seen_pdfs: set[str] = set()
    queue: list[tuple[str, int]] = [(page_url, 0)]
    authority = urlparse(page_url).hostname or ""

    while queue and len(seen_pages) < max_pages and len(pdfs) < max_pdfs:
        url, level = queue.pop(0)
        if url in seen_pages:
            continue
        seen_pages.add(url)

        html = _fetch_page(client, url)
        if html is None:
            continue

        for href in _HREF_RE.findall(html):
            absolute = urljoin(url, href.strip()).split("#", 1)[0]
            if not _is_gov_url(absolute):
                continue
            if _is_pdf_url(absolute):
                if absolute not in seen_pdfs:
                    seen_pdfs.add(absolute)
                    pdfs.append(absolute)
                continue
            if level < depth and absolute not in seen_pages:
                # Stay within the originating department's site.
                if (urlparse(absolute).hostname or "") == authority:
                    queue.append((absolute, level + 1))

    return pdfs[:max_pdfs]


def download_one(
    client: httpx.Client,
    url: str,
    out_dir: Path,
    source_class: str,
    seen_hashes: dict[str, str],
) -> tuple[str, str | None]:
    """Download a single PDF, skipping if present; dedupe by content hash.

    Args:
        client: httpx.Client instance.
        url: PDF URL to download.
        out_dir: Destination directory.
        source_class: 'relevant' or 'not_relevant'.
        seen_hashes: Map of sha256 -> filename already downloaded this run.

    Returns:
        (status, filename) where status is one of
        'downloaded' | 'skipped' | 'duplicate' | 'failed'.
    """
    filename = _filename_from_url(url)
    dest = out_dir / filename

    if dest.exists():
        logger.info("Skipping (already exists): %s", filename)
        return "skipped", filename

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        if attempt > 1:
            delay = _BACKOFF_BASE ** attempt + random.uniform(0, 1.0)
            logger.info("Retry %d/%d for %s in %.1fs...", attempt, _MAX_ATTEMPTS, filename, delay)
            time.sleep(delay)

        try:
            with client.stream(
                "GET", url, headers=_headers(), timeout=_TIMEOUT_SECONDS, follow_redirects=True
            ) as resp:
                resp.raise_for_status()
                data = b"".join(resp.iter_bytes())
        except httpx.HTTPError as exc:
            logger.warning("Attempt %d failed for %s: %s", attempt, url, exc)
            continue

        if not data.startswith(b"%PDF"):
            logger.warning("Skipping %s: response is not a PDF (%d bytes)", url, len(data))
            return "failed", None

        digest = hashlib.sha256(data).hexdigest()
        if digest in seen_hashes:
            logger.info("Skipping duplicate content of %s (already have %s)", filename, seen_hashes[digest])
            return "duplicate", None

        # Same filename, different content: keep both with a numeric suffix.
        while dest.exists():
            dest = out_dir / f"{dest.stem}_{len(seen_hashes)}{dest.suffix}"

        dest.write_bytes(data)
        seen_hashes[digest] = dest.name
        logger.info("Downloaded: %s (%d bytes)", dest.name, len(data))
        return "downloaded", dest.name

    return "failed", None


def _infer_class_from_name(filename: str) -> str:
    """Best-effort class guess for PDFs that predate the downloader."""
    lowered = filename.lower()
    if any(h in lowered for h in _NOT_RELEVANT_NAME_HINTS):
        return "not_relevant"
    if any(h in lowered for h in _RELEVANT_NAME_HINTS):
        return "relevant"
    return "unknown"


def _read_manifest(out_dir: Path) -> dict[str, tuple[str, str]]:
    """Read filename -> (url, source_class) from an existing manifest, if present."""
    manifest = out_dir / _MANIFEST_NAME
    if not manifest.exists():
        return {}

    entries: dict[str, tuple[str, str]] = {}
    try:
        with manifest.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                entries[row["filename"]] = (row.get("url", ""), row["source_class"])
    except Exception:  # noqa: BLE001
        pass
    return entries


def _existing_counts(out_dir: Path) -> dict[str, int]:
    """Count PDFs already on disk per source class (manifest first, else name)."""
    manifest = _read_manifest(out_dir)
    counts = {"relevant": 0, "not_relevant": 0}
    for pdf in out_dir.glob("*.pdf"):
        cls = manifest.get(pdf.name, ("", ""))[1] or _infer_class_from_name(pdf.name)
        if cls in counts:
            counts[cls] += 1
    return counts


def _write_manifest(out_dir: Path, entries: dict[str, tuple[str, str]]) -> None:
    """Write _manifest.csv covering every PDF currently in out_dir."""
    rows: list[tuple[str, str, str]] = []
    for pdf in sorted(out_dir.glob("*.pdf")):
        if pdf.name in entries:
            url, cls = entries[pdf.name]
        else:
            url, cls = "", _infer_class_from_name(pdf.name)
        rows.append((pdf.name, url, cls))

    manifest = out_dir / _MANIFEST_NAME
    with manifest.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "url", "source_class"])
        writer.writerows(rows)
    logger.info("Wrote manifest with %d entries to %s", len(rows), manifest.name)


def main() -> None:
    """Acquire the corpus from curated seeds and crawled listing pages."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=_OUT_DIR)
    parser.add_argument("--no-crawl", action="store_true", help="Use only curated seed URLs.")
    parser.add_argument("--max-pages", type=int, default=15, help="Pages fetched per crawl target.")
    parser.add_argument("--max-pdfs", type=int, default=40, help="PDFs collected per crawl target.")
    parser.add_argument(
        "--max-per-class",
        type=int,
        default=_DEFAULT_MAX_PER_CLASS,
        help="Stop downloading once this many PDFs exist per class (0 = unlimited).",
    )
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)

    # Candidates: curated seeds first (guaranteed), then crawled links.
    candidates: dict[str, str] = dict(_SEEDS)

    with httpx.Client(verify=False) as client:
        if not args.no_crawl:
            for page_url, source_class in _CRAWL_TARGETS:
                found = discover_pdfs(
                    client, page_url, max_pages=args.max_pages, max_pdfs=args.max_pdfs
                )
                logger.info("Crawl %s -> %d PDF links", page_url, len(found))
                for pdf_url in found:
                    candidates.setdefault(pdf_url, source_class)

        logger.info("Total candidate URLs: %d", len(candidates))

        # Group candidates by class so each class can be capped independently.
        by_class: dict[str, list[str]] = {"relevant": [], "not_relevant": []}
        for url, source_class in candidates.items():
            by_class[source_class].append(url)

        class_counts = _existing_counts(args.out_dir)
        logger.info(
            "Starting corpus: %d relevant, %d not_relevant (cap %d per class)",
            class_counts["relevant"], class_counts["not_relevant"], args.max_per_class,
        )

        seen_hashes: dict[str, str] = {}
        entries: dict[str, tuple[str, str]] = _read_manifest(args.out_dir)
        failures: list[str] = []
        counts = {"downloaded": 0, "skipped": 0, "duplicate": 0, "failed": 0}

        for source_class, urls in by_class.items():
            cap = args.max_per_class
            if cap and class_counts[source_class] >= cap:
                logger.info(
                    "Class %s already at cap (%d) — skipping %d candidates.",
                    source_class, class_counts[source_class], len(urls),
                )
                continue

            for url in urls:
                if cap and class_counts[source_class] >= cap:
                    logger.info("Class %s reached cap (%d) — stopping.", source_class, cap)
                    break

                status, filename = download_one(client, url, args.out_dir, source_class, seen_hashes)
                counts[status] += 1
                if status == "failed":
                    failures.append(url)
                if filename and status in ("downloaded", "skipped"):
                    entries[filename] = (url, source_class)
                    if status == "downloaded":
                        class_counts[source_class] += 1
                time.sleep(_SLEEP_BETWEEN_DOWNLOADS)

    _write_manifest(args.out_dir, entries)

    if failures:
        (args.out_dir / "_failed.txt").write_text("\n".join(failures) + "\n", encoding="utf-8")

    total_pdfs = len(list(args.out_dir.glob("*.pdf")))
    print(f"\nResults in {args.out_dir}:")
    print(f"  downloaded: {counts['downloaded']}, skipped: {counts['skipped']}, "
          f"duplicate: {counts['duplicate']}, failed: {counts['failed']}")
    print(f"  corpus now -> relevant: {class_counts['relevant']}, "
          f"not_relevant: {class_counts['not_relevant']}")
    print(f"  total PDFs on disk: {total_pdfs}")
    if failures:
        print(f"  failures logged to {args.out_dir / '_failed.txt'}")


if __name__ == "__main__":
    main()
