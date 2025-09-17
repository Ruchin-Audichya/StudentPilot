"""
Company career pages scrapers (modular).

Exports:
- scrape_company_careers(url: str, limit: int = 50) -> List[Dict]
- scrape_multiple(urls: List[str], limit_per_site: int = 50) -> Tuple[List[Dict], List[Dict]]

Design:
- BaseScraper interface with can_handle + scrape
- Concrete handlers for common ATS providers (Lever, Greenhouse)
- GenericHTMLScraper fallback for simple listings pages

All scrapers must be resilient: short timeouts, retries where reasonable, and
return an empty list rather than raising.
"""
from typing import List, Dict, Tuple

from .base import BaseScraper
from .lever import LeverScraper
from .greenhouse import GreenhouseScraper
from .generic import GenericHTMLScraper
from .smartrecruiters import SmartRecruitersScraper
from .workday import WorkdayScraper


_SCRAPERS: List[BaseScraper] = [
    LeverScraper(),
    GreenhouseScraper(),
    SmartRecruitersScraper(),
    WorkdayScraper(),
    # Add more ATS-specific handlers above the generic fallback
    GenericHTMLScraper(),
]


def _pick_scraper(url: str) -> BaseScraper:
    for s in _SCRAPERS:
        if s.can_handle(url):
            return s
    # Fallback to generic
    return GenericHTMLScraper()


def scrape_company_careers(url: str, limit: int = 50) -> List[Dict]:
    """Scrape a single careers URL.

    Returns a list of dictionaries with keys: title, location, apply_url, description, company?, source
    """
    scraper = _pick_scraper(url)
    return scraper.scrape(url, limit=limit)


def scrape_multiple(urls: List[str], limit_per_site: int = 50) -> Tuple[List[Dict], List[Dict]]:
    """Scrape multiple careers URLs; never fail whole batch.

    Returns (results, errors) where errors are dicts: {url, error}
    """
    all_items: List[Dict] = []
    errors: List[Dict] = []
    for u in urls:
        try:
            items = scrape_company_careers(u, limit=limit_per_site)
            for it in items:
                it.setdefault("source", "company-careers")
                it.setdefault("apply_url", it.get("apply_url") or it.get("url"))
                it.setdefault("location", it.get("location") or "")
            all_items.extend(items)
        except Exception as e:  # pragma: no cover - safety net
            errors.append({"url": u, "error": str(e)})
            continue
    return all_items, errors
