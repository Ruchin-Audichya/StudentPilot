import re
from typing import List, Dict

import requests
from bs4 import BeautifulSoup

from .base import BaseScraper


class LeverScraper(BaseScraper):
    """Scrape Lever-hosted job boards.

    Supports typical patterns like:
    - https://jobs.lever.co/<company>
    - https://<company>.lever.co
    - Company career page sections that embed Lever boards.
    """

    _HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    def can_handle(self, url: str) -> bool:
        return "lever.co" in url

    def _guess_api(self, url: str) -> str | None:
        # Try to infer the JSON endpoint: https://api.lever.co/v0/postings/{company}?mode=json
        m = re.search(r"https?://(?:jobs\.)?lever\.co/([^/?#]+)", url)
        if not m:
            m = re.search(r"https?://([a-z0-9\-]+)\.lever\.co", url)
        if m:
            company = m.group(1)
            return f"https://api.lever.co/v0/postings/{company}?mode=json"
        return None

    def scrape(self, url: str, limit: int = 50) -> List[Dict]:
        items: List[Dict] = []
        # Company slug fallback from URL
        company_slug = None
        m = re.search(r"https?://(?:jobs\.)?lever\.co/([^/?#]+)", url)
        if not m:
            m = re.search(r"https?://([a-z0-9\-]+)\.lever\.co", url)
        if m:
            company_slug = m.group(1)

        # 1) Try Lever JSON API if company inferred
        api_url = self._guess_api(url)
        if api_url:
            try:
                resp = requests.get(api_url, headers=self._HEADERS, timeout=12)
                if resp.ok:
                    data = resp.json()
                    for d in data[:limit]:
                        title = d.get("text") or d.get("title") or "Internship"
                        # Filter to internships only
                        if not re.search(r"\bintern\w*", title, re.I):
                            continue
                        apply = d.get("hostedUrl") or d.get("applyUrl") or d.get("url") or url
                        location = (d.get("categories") or {}).get("location") or ""
                        desc = (d.get("descriptionPlain") or d.get("description") or "").strip()
                        items.append({
                            "title": title.strip(),
                            "location": location.strip(),
                            "apply_url": apply,
                            "description": _normalize_html(desc)[:800],
                            "company": (d.get("company") or {}).get("name") or company_slug,
                            "source": "lever",
                        })
                    if items:
                        return items
            except Exception:
                pass

        # 2) Fallback: parse HTML listing page for links
        try:
            r = requests.get(url, headers=self._HEADERS, timeout=12)
            r.raise_for_status()
            soup = BeautifulSoup(r.content, "html.parser")
            postings = soup.select(".posting, .lever, a[href*='lever.co']")
            for p in postings[: limit * 2]:
                a = p if p.name == "a" else p.select_one("a")
                if not a:
                    continue
                href = a.get("href")
                text = a.get_text(" ", strip=True)
                if href and text and re.search(r"\bintern\w*", text, re.I):
                    items.append({
                        "title": text,
                        "location": _extract_location(soup, p) or "",
                        "apply_url": href,
                        "description": "",
                        "company": company_slug,
                        "source": "lever",
                    })
                if len(items) >= limit:
                    break
        except Exception:
            pass
        return items


def _extract_location(soup: BeautifulSoup, container) -> str | None:
    # Try common Lever markup near the posting
    loc = None
    if hasattr(container, "select_one"):
        c = container.select_one(".posting-categories, .sort-by-location, .location")
        if c:
            loc = c.get_text(" ", strip=True)
    if not loc:
        # Global hints on page
        g = soup.select_one(".location, .locations, [data-qa='location']")
        if g:
            loc = g.get_text(" ", strip=True)
    return loc


def _normalize_html(text: str) -> str:
    from bs4 import BeautifulSoup as _BS
    try:
        t = text or ""
        if "<" in t and ">" in t:
            return _BS(t, "html.parser").get_text(" ", strip=True)
        return t
    except Exception:
        return (text or "").strip()
