import re
from typing import List, Dict

import requests
from bs4 import BeautifulSoup

from .base import BaseScraper


class GreenhouseScraper(BaseScraper):
    """Scrape Greenhouse-hosted job boards.

    Typical URLs:
    - https://boards.greenhouse.io/<company>
    - Company pages embedding Greenhouse job board links
    """

    _HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    def can_handle(self, url: str) -> bool:
        return "greenhouse.io" in url

    def _guess_api(self, url: str) -> str | None:
        m = re.search(r"https?://boards\.greenhouse\.io/([^/?#]+)", url)
        if m:
            company = m.group(1)
            return f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
        return None

    def scrape(self, url: str, limit: int = 50) -> List[Dict]:
        items: List[Dict] = []
        api = self._guess_api(url)
        # Company slug from URL for fallback
        company_slug = None
        m = re.search(r"https?://boards\.greenhouse\.io/([^/?#]+)", url)
        if m:
            company_slug = m.group(1)
        # 1) Public API
        if api:
            try:
                resp = requests.get(api, headers=self._HEADERS, timeout=12)
                if resp.ok:
                    data = resp.json() or {}
                    jobs = data.get("jobs", [])
                    count = 0
                    for d in jobs:
                        title = d.get("title") or "Internship"
                        if not re.search(r"\bintern\w*", title, re.I):
                            continue
                        apply = d.get("absolute_url") or d.get("internal_job_id") or url
                        loc = ""
                        if d.get("location"):
                            loc = d["location"].get("name") or ""
                        desc = (d.get("content") or "").strip()
                        company = company_slug
                        items.append({
                            "title": title.strip(),
                            "location": (loc or "").strip(),
                            "apply_url": apply,
                            "description": _normalize_html(desc)[:800],
                            "company": company,
                            "source": "greenhouse",
                        })
                        count += 1
                        if count >= limit:
                            break
                    if items:
                        return items
            except Exception:
                pass

        # 2) HTML fallback
        try:
            r = requests.get(url, headers=self._HEADERS, timeout=12)
            r.raise_for_status()
            soup = BeautifulSoup(r.content, "html.parser")
            postings = soup.select("section#jobs a[href*='/jobs/']") or soup.select("a[href*='greenhouse.io']")
            for a in postings[: limit * 2]:
                href = a.get("href")
                text = a.get_text(" ", strip=True)
                if not href or not text or not re.search(r"\bintern\w*", text, re.I):
                    continue
                items.append({
                    "title": text,
                    "location": "",
                    "apply_url": href if href.startswith("http") else f"https://boards.greenhouse.io{href}",
                    "description": "",
                    "company": company_slug,
                    "source": "greenhouse",
                })
                if len(items) >= limit:
                    break
        except Exception:
            pass
        return items


def _normalize_html(text: str) -> str:
    from bs4 import BeautifulSoup as _BS
    try:
        t = text or ""
        if "<" in t and ">" in t:
            return _BS(t, "html.parser").get_text(" ", strip=True)
        return t
    except Exception:
        return (text or "").strip()
