# backend/scrapers/internshala.py
import os
import requests
import time
import re
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://internshala.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://internshala.com/internships",
}

# Shared session with simple retries (network resilience) and polite timeouts.
_session = requests.Session()
# Slightly higher retries for flaky datacenter IPs; keep small to respect time budget
_retries = Retry(
    total=3,
    backoff_factor=0.6,  # gentle exponential backoff
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],  # type: ignore
)
_session.mount("https://", HTTPAdapter(max_retries=_retries))
_session.headers.update(HEADERS)

TAG_PATTERNS = {
    "remote": ["remote", "work from home", "wfh"],
    "hybrid": ["hybrid"],
    "onsite": ["on-site", "onsite", "on site"],
    "stipend": ["₹", "stipend", "per month", "per week", "per day"],
    "tech": ["software", "developer", "programming", "coding", "tech", "IT"],
    "data-science": ["data science", "machine learning", "ai", "analytics", "data analyst"],
    "web-dev": ["web development", "frontend", "backend", "full stack", "react", "javascript"],
    "mobile": ["mobile app", "android", "ios", "flutter", "react native"],
    "internship": ["internship", "intern", "trainee"],
}

# B.Tech/Tech focused keywords for enhanced searching
BTECH_TECH_KEYWORDS = [
    "software engineer", "software developer", "web developer", "frontend developer", 
    "backend developer", "full stack developer", "data scientist", "data analyst",
    "machine learning", "artificial intelligence", "python developer", "java developer",
    "javascript developer", "react developer", "node.js developer", "mobile app developer",
    "android developer", "ios developer", "devops engineer", "cloud engineer",
    "cybersecurity", "network engineer", "database administrator", "IT support",
    "quality assurance", "software testing", "ui/ux designer", "product manager"
]

def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip()) if text else ""

def _auto_tags(desc: str) -> List[str]:
    """
    Generate tags based on job description content.
    """
    tags = []
    d = desc.lower()
    for tag, keys in TAG_PATTERNS.items():
        if any(k in d for k in keys):
            tags.append(tag)
    return tags

def _enhance_query_for_tech(query: str) -> str:
    """
    Enhance search query to be more tech/B.Tech focused if not already.
    """
    query_lower = query.lower()
    
    # If already tech-focused, return as-is
    tech_indicators = ["software", "developer", "programming", "tech", "engineer", "data", "web", "mobile"]
    if any(indicator in query_lower for indicator in tech_indicators):
        return query
    
    # If generic term, enhance with tech context
    if query_lower in ["internship", "intern", "job", "work"]:
        return "software developer internship"
    
    # Add tech context to domain-specific queries
    domain_mapping = {
        "python": "python developer",
        "java": "java developer", 
        "javascript": "javascript developer",
        "react": "react developer",
        "data": "data science",
        "ai": "artificial intelligence developer",
        "ml": "machine learning engineer",
        "web": "web developer",
        "mobile": "mobile app developer",
        "android": "android developer",
        "ios": "ios developer"
    }
    
    for key, enhanced in domain_mapping.items():
        if key in query_lower:
            return enhanced
    
    # Default enhancement for unrecognized terms
    return f"software {query}"

def _calculate_tech_relevance_score(title: str, description: str, skills: List[str] = None) -> float:
    """
    Calculate how relevant a job is for B.Tech/tech students (0-100 scale).
    """
    content = f"{title} {description}".lower()
    if skills:
        content += " " + " ".join(skills).lower()
    
    score = 0.0
    
    # Core tech keywords (high weight)
    high_value_terms = [
        "software engineer", "developer", "programming", "coding", "engineer",
        "computer science", "IT", "technology", "software development"
    ]
    for term in high_value_terms:
        if term in content:
            score += 15
    
    # Specific tech skills (medium weight)
    tech_skills = [
        "python", "java", "javascript", "react", "node", "angular", "vue",
        "html", "css", "sql", "mongodb", "aws", "docker", "git", "linux"
    ]
    for skill in tech_skills:
        if skill in content:
            score += 8
    
    # Tech domains (medium weight)
    domains = [
        "web development", "mobile app", "data science", "machine learning",
        "artificial intelligence", "cybersecurity", "cloud", "devops"
    ]
    for domain in domains:
        if domain in content:
            score += 10
    
    # B.Tech friendly terms (low weight)
    btech_terms = ["intern", "trainee", "fresher", "graduate", "entry level", "junior"]
    for term in btech_terms:
        if term in content:
            score += 5
    
    # Negative indicators (reduce score)
    non_tech_terms = [
        "sales", "marketing", "content writing", "graphic design", "finance",
        "hr", "human resources", "business development", "accounting"
    ]
    for term in non_tech_terms:
        if term in content:
            score -= 10
    
    return min(100.0, max(0.0, score))

def _fetch_detail_page(url: str) -> Dict[str, str]:
    """
    Fetch the internship detail page and extract extra fields:
    - full description
    - about company
    - requirements / skills
    - posted date
    """
    out: Dict[str, str] = {}
    try:
        r = _session.get(url, timeout=14)
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

def _candidate_urls(enhanced_query: str, location: Optional[str]) -> List[str]:
    q = "-".join(enhanced_query.strip().split())
    urls = []
    # Prefer simpler keyword pages first (less likely to be blocked), then category-filtered
    base_kw = f"{BASE_URL}/internships/keywords-{q}"
    urls.append(base_kw)
    if location:
        loc = "-".join(location.strip().split())
        urls.append(f"{base_kw}/in-{loc}")
    # Category-filtered variants (can be heavier; try last)
    cat = "/category-computer%20science,information%20technology,software%20development,web%20development"
    urls.append(base_kw + cat)
    if location:
        urls.append(f"{base_kw}/in-{'-'.join(location.strip().split())}" + cat)
    # Pagination variants as a last resort (page-1 and page-2)
    urls.append(base_kw + "/page-1")
    urls.append(base_kw + "/page-2")
    if location:
        urls.append(f"{base_kw}/in-{'-'.join(location.strip().split())}/page-1")
        urls.append(f"{base_kw}/in-{'-'.join(location.strip().split())}/page-2")
    return urls

def fetch_internships(query: str, location: Optional[str] = None, limit: int = 12) -> List[Dict]:
    """
    Scrape Internshala for tech-focused internships matching the given keyword query.
    Enhanced for B.Tech/CS students with better query building and relevance scoring.
    Also fetches full job description and extra metadata from detail pages.
    """
    # Enhance query for better tech job targeting
    enhanced_query = _enhance_query_for_tech(query)
    
    urls = _candidate_urls(enhanced_query, location)
    # Tunables
    # Allow either INTERNSHALA_HTTP_TIMEOUT or legacy INSHALA_HTTP_TIMEOUT
    req_timeout = int(os.getenv("INTERNSHALA_HTTP_TIMEOUT", os.getenv("INSHALA_HTTP_TIMEOUT", "15")))
    tech_min = float(os.getenv("TECH_RELEVANCE_MIN", "8"))
    debug = os.getenv("DEBUG_SCRAPERS", "0").lower() in {"1","true","yes","on"}
    soup = None
    last_err = None
    cards = []
    used_url = None
    for u in urls:
        try:
            resp = _session.get(u, timeout=req_timeout)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.content, "html.parser")
            # Try multiple selector variants; site markup changes periodically
            cards = soup.select("div.individual_internship")
            if not cards:
                cards = soup.select("div.container-fluid.individual_internship")
            if not cards:
                cards = soup.select("div[class*='individual_internship']")
            if cards:
                used_url = u
                break
        except Exception as e:
            last_err = e
            continue
    if not cards:
        if debug:
            print(f"[internshala] no cards found. last_err={last_err} url_tried={used_url}")
        # Give up silently; upstream will synthesize samples if enabled
        return []
    items: List[Dict] = []

    for idx, card in enumerate(cards[:limit*3]):  # Fetch more initially to filter better
        title_tag = card.select_one("h3 a, a.view_detail_button, a[href*='/internship/']")
        title = title_tag.get_text(strip=True) if title_tag else "Internship"

        company_tag = card.select_one("div.company_name a, div.company_name, .company_and_premium span.company-name")
        company = company_tag.get_text(strip=True) if company_tag else "Company"

        link = title_tag.get("href") if title_tag else None
        if link and link.startswith("/"):
            link = BASE_URL + link

        loc_tag = card.select_one(".locations > a, .location_link, .location, .locations span")
        loc_txt = loc_tag.get_text(strip=True) if loc_tag else "India"

        stipend_node = card.select_one(".stipend, span.stipend")
        stipend = stipend_node.get_text(strip=True) if stipend_node else ""

        desc_sec = card.select_one(".internship_meta, .other_detail_item_row, .details, .internship_desc") or card
        desc_text = desc_sec.get_text(" ", strip=True)

        tags = []
        for t in card.select(".tag_container .round_tabs a, .tag_container span"):
            tx = t.get_text(strip=True)
            if tx:
                tags.append(tx.lower())

        # Fetch detail page for full info
        extra = {}
        if link and idx < 3:
            extra = _fetch_detail_page(link)

        # Calculate tech relevance score
        full_desc = extra.get("description_full") or desc_text
        skills_required = extra.get("skills_required") or []
        tech_score = _calculate_tech_relevance_score(title, full_desc, skills_required)

        # Filter out low-relevance jobs; keep threshold modest on prod infra
        if tech_score < tech_min:
            continue

        # Merge tags with auto-detected ones
        combined_tags = list(set(tags + _auto_tags(desc_text + " " + extra.get("description_full", ""))))

        # Add tech-specific tags
        if tech_score >= 70:
            combined_tags.append("high-tech-match")
        if any(skill in ["python", "java", "javascript", "react"] for skill in skills_required):
            combined_tags.append("popular-tech")

        job_item = {
            "title": _normalize(title),
            "company": _normalize(company),
            "location": _normalize(loc_txt),
            "stipend": stipend or None,
            "apply_url": link or used_url,
            "description": _normalize(full_desc)[:800],
            "tags": combined_tags,
            "source": "internshala",
            "about_company": extra.get("about_company"),
            "skills_required": extra.get("skills_required"),
            "posted": extra.get("posted"),
            "tech_relevance_score": tech_score,  # Include for debugging/sorting
        }

        items.append(job_item)

        # Stop when we have enough high-quality results
        if len(items) >= limit:
            break

    # Sort by tech relevance score (highest first)
    items.sort(key=lambda x: x.get("tech_relevance_score", 0), reverse=True)
    
    return items[:limit]
