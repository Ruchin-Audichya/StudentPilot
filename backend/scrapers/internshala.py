# backend/scrapers/internshala.py
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional

def fetch_internships(query: str, location: Optional[str] = None, limit: int = 12) -> List[Dict]:
    """
    Scrape Internshala for internships matching the given keyword query.
    Returns a list of dictionaries with internship details.
    """
    q = "-".join(query.strip().split())
    url = f"https://internshala.com/internships/keywords-{q}"
    if location:
        loc = "-".join(location.strip().split())
        url += f"/in-{loc}"

    try:
        resp = requests.get(
            url,
            timeout=15,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/123.0 Safari/537.36"
                )
            },
        )
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
            link = "https://internshala.com" + link

        loc_tag = card.select_one(".locations > a, .location_link")
        loc_txt = loc_tag.get_text(strip=True) if loc_tag else "India"

        stipend_node = card.select_one(".stipend")
        stipend = stipend_node.get_text(strip=True) if stipend_node else ""

        desc_sec = card.select_one(".internship_meta") or card
        desc_text = desc_sec.get_text(" ", strip=True)[:280]

        tags = []
        for t in card.select(".tag_container .round_tabs a, .tag_container span"):
            tx = t.get_text(strip=True)
            if tx:
                tags.append(tx.lower())

        items.append({
            "title": title,
            "company": company,
            "location": loc_txt,
            "stipend": stipend or None,
            "apply_url": link or url,
            "description": desc_text,
            "tags": tags,
            "source": "internshala",
        })

    return items
