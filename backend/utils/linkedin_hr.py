from __future__ import annotations

from typing import List, Dict, Optional, Iterable
from urllib.parse import quote


def _clean_tokens(values: Optional[Iterable[str]], max_n: int) -> List[str]:
    if not values:
        return []
    out: List[str] = []
    for v in values:
        if not v:
            continue
        t = str(v).strip()
        if not t:
            continue
        if t.lower() in {"and", "the", "a", "an"}:
            continue
        out.append(t)
        if len(out) >= max_n:
            break
    return out


def _compose_people_query(role: str, skills: List[str], location: Optional[str]) -> str:
    # Example target phrase: "recruiter software engineer python" etc.
    base_terms = ["recruiter"]
    # Emphasize 'technical recruiter' for engineering roles
    if any(k in role.lower() for k in ["engineer", "developer", "data", "ml", "ai", "software"]):
        base_terms = ["technical recruiter", "recruiter"]
    terms = base_terms + [role] + skills[:2]
    q = " ".join(terms).strip()
    params = f"keywords={quote(q)}"
    filters = "&network=%5B%22F%22%2C%22S%22%5D"  # 1st + 2nd degree network by default
    if location:
        loc = quote(location)
        filters += f"&geoUrnAlias={loc}"
    # People search
    return f"https://www.linkedin.com/search/results/people/?{params}{filters}"


def generate_hr_search_links(
    skills: Optional[Iterable[str]] = None,
    roles: Optional[Iterable[str]] = None,
    location: Optional[str] = None,
    limit: int = 8,
) -> List[Dict[str, str]]:
    """Generate LinkedIn people-search URLs for recruiters/HRs.

    Input:
      - skills: list of extracted skills (top 3 used)
      - roles: list of desired roles (each produces a link)
      - location: optional city/country hint string (free text)
      - limit: max number of links to return across roles

    Returns list of { label, url } objects.
    """
    skills_top = _clean_tokens(skills, 3)
    roles_top = _clean_tokens(roles, 6) or ["software engineer"]
    loc = (location or "").strip() or None

    links: List[Dict[str, str]] = []
    for r in roles_top:
        url = _compose_people_query(r, skills_top, loc)
        label = f"Recruiters for {r}"
        if loc:
            label += f" in {loc}"
        links.append({"label": label, "url": url})
        if len(links) >= limit:
            break

    # If we still have capacity, add pure-skill based search links
    if len(links) < limit and skills_top:
        q = "technical recruiter " + " ".join(skills_top)
        url = f"https://www.linkedin.com/search/results/people/?keywords={quote(q)}&network=%5B%22F%22%2C%22S%22%5D"
        if loc:
            url += f"&geoUrnAlias={quote(loc)}"
        links.append({"label": f"Recruiters for {', '.join(skills_top)}", "url": url})

    return links[:limit]
