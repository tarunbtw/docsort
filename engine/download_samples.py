"""Batch-download sample PDFs into sample_docs/ for dataset building.

Run from engine/:
    python download_samples.py

Downloads every URL in _URLS below into sample_docs/, using the URL's filename.
Skips files that already exist, so it is safe to re-run after adding more URLs.
Add more URLs to the _RELEVANT / _NOT_RELEVANT lists as needed.
"""

import logging
import time
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_OUT_DIR = Path(__file__).parent / "sample_docs"
_TIMEOUT_SECONDS = 30.0
_SLEEP_BETWEEN_DOWNLOADS = 1.0

# Some government servers reject requests with no User-Agent header.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# Real Indian government procurement/contract regulation documents.
_RELEVANT = [
    "https://doe.gov.in/files/procurement-policy-division/Push_Button_Procurement_0.pdf",
    "https://doe.gov.in/files/circulars_document/GeM_through_PFMS_non_PFMS_Agencies_Entities_NPAE_reg_1_0.pdf",
    "https://doe.gov.in/files/manuals_documents/Manual_for_Procurement_of_Goods_Updated%20June,%202022.pdf",
    "https://doe.gov.in/files/procurement-policy-division/RelaxNorms_StarupMedEnterprise25072016.pdf",
    "https://doe.gov.in/files/circulars_document/Manual_Goods_2024.pdf",
    "https://doe.gov.in/files/procurement-policy-division/Department_of_Public_Enterprises_circular.pdf",
    "https://doe.gov.in/files/circulars_document/MfPoCS_2025.pdf",
    "https://doe.gov.in/files/circulars_document/MfPoNCS_2025.pdf",
    "https://doe.gov.in/files/circulars_document/Works_Manual_SE_2025.pdf",
    "https://doe.gov.in/files/circulars_document/Draft_Works_Manual_2nd_Edition.pdf",
]

# Real government documents that are NOT procurement-related: negative examples.
_NOT_RELEVANT = [
    "https://www.ugc.gov.in/pdfnews/3045759_Draft-Regulation-Minimum-Qualifications-for-Appointment-and-Promotion-of-Teachers-and-Academic-Staff-in-Universities-and-Colleges-and-Measures-for-the-Maintenance-of-Standards-in-HE-Regulations-2025.pdf",
    "https://www.ugc.gov.in/pdfnews/7039866_UGC-Letter-Draft-Regulation-and-Guidelines.pdf",
    "https://dopt.gov.in/sites/default/files/Holiday%20list%20(1).pdf",
    "https://dopt.gov.in/sites/default/files/Holidays%20to%20be%20observed%20in%20Central%20Government%20Offices%20during%20the%20year%202026.pdf",
    "https://documents.doptcirculars.nic.in/D2/D02est/Holidays%20to%20be%20observed%20in%20Central%20Government%20Offices%20during%20the%20year%2020265vgBs.pdf",
    "https://dfe.gov.in/uploads/documents/list-of-gazetted-holidays-2026.pdf",
]

_URLS = _RELEVANT + _NOT_RELEVANT


def _filename_from_url(url: str) -> str:
    """Derive a clean local filename from a URL.

    Args:
        url: The source URL.

    Returns:
        A decoded, filesystem-safe filename.
    """
    return unquote(Path(urlparse(url).path).name)


def download_one(client: httpx.Client, url: str, out_dir: Path) -> bool:
    """Download a single PDF, skipping if it already exists.

    Args:
        client: httpx.Client instance.
        url: URL to download.
        out_dir: Destination directory.

    Returns:
        True if the file was downloaded or already present, False on failure.
    """
    filename = _filename_from_url(url)
    dest = out_dir / filename

    if dest.exists():
        logger.info("Skipping (already exists): %s", filename)
        return True

    for attempt in range(1, 3):  # One retry for transient timeouts/resets.
        try:
            response = client.get(url, headers=_HEADERS, timeout=_TIMEOUT_SECONDS, follow_redirects=True)
            response.raise_for_status()
            dest.write_bytes(response.content)
            logger.info("Downloaded: %s (%d bytes)", filename, len(response.content))
            return True
        except httpx.HTTPError as exc:
            logger.warning("Attempt %d failed for %s: %s", attempt, url, exc)
            if attempt == 2:
                return False
            time.sleep(3)

    return False


def main() -> None:
    """Download every URL in _URLS into sample_docs/."""
    _OUT_DIR.mkdir(parents=True, exist_ok=True)

    successes = 0
    with httpx.Client(verify=False) as client:
        for url in _URLS:
            if download_one(client, url, _OUT_DIR):
                successes += 1
            time.sleep(_SLEEP_BETWEEN_DOWNLOADS)

    print(f"\nDownloaded/verified {successes}/{len(_URLS)} files into {_OUT_DIR}")


if __name__ == "__main__":
    main()
