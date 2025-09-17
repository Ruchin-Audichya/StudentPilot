import os
import time
from typing import List, Dict, Optional

import requests
from bs4 import BeautifulSoup


def _enhance_query(query: str) -> str:
    tech_keywords = [
        "software engineer", "developer", "programming", "backend", "frontend",
        "full stack", "data science", "machine learning", "python", "java",
        "javascript", "react", "web development", "mobile app", "software development",
    ]
    q = query.strip()
    if not any(k in q.lower() for k in tech_keywords[:8]):
        if "internship" not in q.lower():
            q = f"software {q} internship"
        else:
            q = f"software {q}"
    return q


def _build_search_url(query: str, location: Optional[str]) -> str:
    from urllib.parse import quote
    q = quote(" ".join(query.split()))
    url = f"https://www.linkedin.com/jobs/search/?keywords={q}&f_E=1,2&f_I=4,6,96,3"
    if location:
        url += f"&location={quote(location)}"
    return url


def _http_fetch(url: str, timeout: float = 12.0) -> Optional[str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        if r.status_code == 200 and r.text:
            return r.text
    except Exception:
        return None
    return None


def _parse_cards(html: str, limit: int) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("div.base-card")[:limit]
    out: List[Dict] = []
    for card in cards:
        title_tag = card.select_one("h3.base-search-card__title")
        title = title_tag.get_text(strip=True) if title_tag else "Internship"
        company_tag = card.select_one("h4.base-search-card__subtitle")
        company = company_tag.get_text(strip=True) if company_tag else "Company"
        link_tag = card.select_one("a.base-card__full-link")
        apply_url = link_tag.get("href") if link_tag else None
        loc_tag = card.select_one("span.job-search-card__location")
        location = loc_tag.get_text(strip=True) if loc_tag else None
        desc = card.get_text(" ", strip=True)[:280]

        content_lower = f"{title} {desc}".lower()
        auto_tags: List[str] = []
        if "remote" in content_lower or "wfh" in content_lower:
            auto_tags.append("remote")
        if "full stack" in content_lower or "fullstack" in content_lower:
            auto_tags.append("full-stack")
        if any(lang in content_lower for lang in ["python", "java", "javascript", "react", "node"]):
            auto_tags.append("programming")
        if any(term in content_lower for term in ["data science", "machine learning", "ai", "analytics"]):
            auto_tags.append("data-science")
        if any(term in content_lower for term in ["backend", "api", "server"]):
            auto_tags.append("backend")
        if any(term in content_lower for term in ["frontend", "ui", "ux", "web"]):
            auto_tags.append("frontend")

        out.append({
            "title": title,
            "company": company,
            "location": location or "",
            "stipend": None,
            "apply_url": apply_url or "",
            "description": desc,
            "tags": auto_tags,
            "source": "linkedin",
        })
    return out


def fetch_linkedin_internships(query: str, location: Optional[str] = 'India', limit: int = 12) -> List[Dict]:
    if os.getenv("DISABLE_LINKEDIN", "0") in {"1", "true", "yes", "on"}:
        return []

    enhanced_query = _enhance_query(query)
    url = _build_search_url(enhanced_query, location)

    # First try light HTTP fetch (fast and resource-friendly)
    html = _http_fetch(url)
    results: List[Dict] = []
    if html:
        results = _parse_cards(html, limit)
        if results:
            return results

    # Optional Playwright fallback (headless, still lighter than full Selenium)
    try:
        from playwright.sync_api import sync_playwright  # type: ignore
    except Exception:
        # If Playwright isn't available, return empty (or keep HTTP results if any)
        return results

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1366, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                ),
                locale="en-US",
            )
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            # Attempt minimal scroll to trigger content hydration
            for _ in range(2):
                page.mouse.wheel(0, 2000)
                time.sleep(0.8)
            html2 = page.content()
            browser.close()
        if html2:
            pw = _parse_cards(html2, limit)
            if pw:
                return pw
    except Exception:
        # Swallow and return whatever we have
        pass

    return results