import re
from typing import List, Dict

import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

from .base import BaseScraper


class WorkdayScraper(BaseScraper):
    """Best-effort scraper for Workday-hosted career pages.

    Workday often renders postings dynamically, but many installations expose job links in the HTML.
    This scraper collects anchors with job-like slugs under workday domains.
    """

    _HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    def can_handle(self, url: str) -> bool:
        return "workday" in url

    def scrape(self, url: str, limit: int = 50) -> List[Dict]:
        items: List[Dict] = []
        # Derive company from subdomain like company.wd1.myworkdayjobs.com
        company_slug = None
        try:
            host = urlparse(url).hostname or ""
            m = re.match(r"^([a-z0-9\-]+)\.wd\d+\.myworkdayjobs\.com", host)
            if m:
                company_slug = m.group(1)
        except Exception:
            company_slug = None
        try:
            r = requests.get(url, headers=self._HEADERS, timeout=12)
            r.raise_for_status()
            soup = BeautifulSoup(r.content, "html.parser")
            anchors = soup.select("a[href]")
            for a in anchors:
                href = a.get("href") or ""
                text = a.get_text(" ", strip=True)
                if not href or not text:
                    continue
                # Heuristic: postings often live under /en-US/jobs/ or have jobId params
                if re.search(r"/job/|/jobs/|jobId=", href, re.I) and any(k in text.lower() for k in ["intern", "internship", "trainee"]):
                    # Normalize relative
                    if href.startswith("/"):
                        from urllib.parse import urljoin
                        href = urljoin(url, href)
                    items.append({
                        "title": text.strip(),
                        "location": "",
                        "apply_url": href,
                        "description": "",
                        "company": company_slug,
                        "source": "workday",
                    })
                    if len(items) >= limit:
                        break
        except Exception:
            return items
        return items
