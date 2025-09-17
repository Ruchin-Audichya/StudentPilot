import re
from typing import List, Dict

import requests

from .base import BaseScraper


class SmartRecruitersScraper(BaseScraper):
    """Scrape SmartRecruiters-hosted boards.

    Examples:
    - https://careers.smartrecruiters.com/<Company>
    - API query per company: https://api.smartrecruiters.com/v1/companies/{company}/postings?released=true
    """

    _HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "application/json, text/plain, */*",
    }

    def can_handle(self, url: str) -> bool:
        return "smartrecruiters.com" in url

    def _guess_company(self, url: str) -> str | None:
        m = re.search(r"https?://careers\.smartrecruiters\.com/([^/?#]+)", url)
        if m:
            return m.group(1)
        return None

    def scrape(self, url: str, limit: int = 50) -> List[Dict]:
        items: List[Dict] = []
        company = self._guess_company(url)
        if not company:
            return items
        api = f"https://api.smartrecruiters.com/v1/companies/{company}/postings?released=true&limit={max(10, min(100, limit))}"
        try:
            r = requests.get(api, headers=self._HEADERS, timeout=12)
            if r.ok:
                data = r.json() or {}
                postings = data.get("content") or []
                for p in postings:
                    title = (p.get("name") or "Internship").strip()
                    if not re.search(r"\bintern\w*", title, re.I):
                        continue
                    apply = p.get("ref") or p.get("applyUrl") or p.get("jobAdId")
                    loc = ""
                    if p.get("location") and p["location"].get("city"):
                        loc = p["location"]["city"]
                    desc = (p.get("jobAd") or {}).get("sections", {}).get("jobDescription", {}).get("text", "")
                    items.append({
                        "title": title,
                        "location": loc or "",
                        "apply_url": apply or url,
                        "description": (desc or "").strip()[:800],
                        "company": company,
                        "source": "smartrecruiters",
                    })
                    if len(items) >= limit:
                        break
        except Exception:
            return items
        return items
