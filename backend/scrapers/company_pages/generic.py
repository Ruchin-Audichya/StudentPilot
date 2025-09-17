from typing import List, Dict
import re

import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin

from .base import BaseScraper


class GenericHTMLScraper(BaseScraper):
    """Very lightweight fallback scraper for simple career listings.

    Heuristics:
    - Find anchors that look like job links (contain words like 'intern', 'internship').
    - Attempt to capture adjacent location text.
    - Extract short description from nearby paragraph/list.
    """

    _HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    def can_handle(self, url: str) -> bool:
        # Always true as a fallback
        return True

    def scrape(self, url: str, limit: int = 50) -> List[Dict]:
        items: List[Dict] = []
        try:
            r = requests.get(url, headers=self._HEADERS, timeout=12)
            r.raise_for_status()
            soup = BeautifulSoup(r.content, "html.parser")
            anchors = soup.select("a[href]")
            for a in anchors:
                text = a.get_text(" ", strip=True)
                if not text:
                    continue
                t = text.lower()
                if not _looks_like_internship(t):
                    continue
                href = a.get("href")
                # normalize relative links
                if href and href.startswith("/"):
                    href = urljoin(url, href)
                # try to find location near the link
                loc = _find_nearby_location(a)
                desc = _find_nearby_desc(a)
                # derive company from host
                try:
                    host = urlparse(url).hostname or ""
                except Exception:
                    host = ""
                items.append({
                    "title": text.strip(),
                    "location": (loc or "").strip(),
                    "apply_url": href or url,
                    "description": (desc or "").strip()[:500],
                    "company": (host.split(".")[0] if host else None),
                    "source": "generic",
                })
                if len(items) >= limit:
                    break
        except Exception:
            # never raise
            return []
        return items


def _looks_like_internship(text_lower: str) -> bool:
    keywords = ["intern", "internship", "trainee"]
    return any(k in text_lower for k in keywords)


def _find_nearby_location(anchor) -> str | None:
    # Look within the parent and next siblings for location-like patterns
    parent = anchor.parent
    for node in (parent, getattr(parent, "next_sibling", None), getattr(parent, "parent", None)):
        if not node:
            continue
        txt = getattr(node, "get_text", lambda *a, **k: "")(" ", strip=True)
        if not txt:
            continue
        m = re.search(r"\b(?:Location|Based in|City)[:\-\s]+([A-Za-z ,]+)\b", txt, re.I)
        if m:
            return m.group(1)
    return None


def _find_nearby_desc(anchor) -> str | None:
    # Prefer a following paragraph or list item as description
    next_el = getattr(anchor, "find_next", lambda *a, **k: None)(["p", "li"])
    if next_el:
        return next_el.get_text(" ", strip=True)
    parent = anchor.parent
    if parent:
        p = parent.find("p") or parent.find("li")
        if p:
            return p.get_text(" ", strip=True)
    return None
