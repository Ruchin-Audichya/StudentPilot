# backend/scrapers/internshala.py
import requests
import time
import re
from bs4 import BeautifulSoup
from typing import List, Dict, Optional

BASE_URL = "https://internshala.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0 Safari/537.36"
    )
}

TAG_PATTERNS = {
    "remote": ["remote", "work from home", "wfh"],
    "hybrid": ["hybrid"],
    "onsite": ["on-site", "onsite", "on site"],
    "stipend": ["₹", "stipend", "per month", "per week", "per day"],
}

def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip()) if text else ""

def _auto_tags(desc: str) -> List[str]:
    tags = []
    d = desc.lower()
    for tag, keys in TAG_PATTERNS.items():
        if any(k in d for k in keys):
            tags.append(tag)
    return tags

def _fetch_detail_page(url: str) -> Dict[str, str]:
    """
    Fetch the internship detail page and extract extra fields:
    - full description
    - about company
    - requirements / skills
    - posted date
    """
    out = {}
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        soup = BeautifulSoup(r.content, "html.parser")

        # Description
        desc_block = soup.select_one("div.internship_details div.text-container")
        if desc_block:
            out["description_full"] = _normalize(desc_block.get_text(" ", strip=True))

        # About company
        about_block = soup.select_one("div.about_company")
        if about_block:
            out["about_company"] = _normalize(about_block.get_text(" ", strip=True))

        # Skills required
        skills_block = soup.select("div.skills span")
        if skills_block:
            skills = [s.get_text(strip=True) for s in skills_block if s.get_text(strip=True)]
            out["skills_required"] = skills

        # Posted date
        date_block = soup.select_one("div.posted_by_container span")
        if date_block:
            out["posted"] = _normalize(date_block.get_text(strip=True))

    except Exception:
        # Fail silently for detail fetch
        pass
    return out

def fetch_internships(query: str, location: Optional[str] = None, limit: int = 12) -> List[Dict]:
    """
    Scrape Internshala for internships matching the given keyword query.
    Also fetches full job description and extra metadata from detail pages.
    """
    q = "-".join(query.strip().split())
    url = f"{BASE_URL}/internships/keywords-{q}"
    if location:
        loc = "-".join(location.strip().split())
        url += f"/in-{loc}"

    try:
        resp = requests.get(url, timeout=15, headers=HEADERS)
        resp.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(resp.content, "html.parser")
    cards = soup.select("div.container-fluid.individual_internship")
    items: List[Dict] = []

    for card in cards[:limit]:
        title_tag = card.select_one("h3 a")
        title = title_tag.get_text(strip=True) if title_tag else "Internship"

        company_tag = card.select_one("div.company_name a")
        company = company_tag.get_text(strip=True) if company_tag else "Company"

        link = title_tag.get("href") if title_tag else None
        if link and link.startswith("/"):
            link = BASE_URL + link

        loc_tag = card.select_one(".locations > a, .location_link")
        loc_txt = loc_tag.get_text(strip=True) if loc_tag else "India"

        stipend_node = card.select_one(".stipend")
        stipend = stipend_node.get_text(strip=True) if stipend_node else ""

        desc_sec = card.select_one(".internship_meta") or card
        desc_text = desc_sec.get_text(" ", strip=True)

        tags = []
        for t in card.select(".tag_container .round_tabs a, .tag_container span"):
            tx = t.get_text(strip=True)
            if tx:
                tags.append(tx.lower())

        # Fetch detail page for full info
        extra = {}
        if link:
            extra = _fetch_detail_page(link)
            time.sleep(0.6)  # be polite to Internshala

        # Merge tags with auto-detected ones
        combined_tags = list(set(tags + _auto_tags(desc_text + " " + extra.get("description_full", ""))))

        items.append({
            "title": _normalize(title),
            "company": _normalize(company),
            "location": _normalize(loc_txt),
            "stipend": stipend or None,
            "apply_url": link or url,
            "description": _normalize(extra.get("description_full") or desc_text)[:800],
            "tags": combined_tags,
            "source": "internshala",
            "about_company": extra.get("about_company"),
            "skills_required": extra.get("skills_required"),
            "posted": extra.get("posted"),
        })

    return items
