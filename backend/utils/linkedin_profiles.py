from __future__ import annotations

import re
from typing import List, Optional, Iterable, Dict
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup  # type: ignore


def _clean(values: Optional[Iterable[str]], max_n: int = 4) -> List[str]:
    out: List[str] = []
    if not values:
        return out
    for v in values:
        t = (v or "").strip()
        if not t:
            continue
        out.append(t)
        if len(out) >= max_n:
            break
    return out


def _bing_people_query(q: str) -> str:
    # Restrict to LinkedIn public profiles
    qq = quote(f"site:linkedin.com/in/ {q}")
    return f"https://www.bing.com/search?q={qq}&count=10"


def _extract_profiles_from_html(html: str) -> List[Dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    out: List[Dict[str, str]] = []
    for a in soup.select("li.b_algo h2 a, h2 a, a"):  # be permissive
        href = a.get("href") or ""
        if not href or "linkedin.com/in/" not in href:
            continue
        # Basic filter: exclude non-profile paths like company pages
        if any(x in href for x in ["/jobs/", "/company/", "/school/"]):
            continue
        label = a.get_text(strip=True) or "LinkedIn Profile"
        out.append({"label": label, "url": href})
        if len(out) >= 10:
            break
    # Deduplicate by URL
    seen = set()
    uniq: List[Dict[str, str]] = []
    for p in out:
        if p["url"] in seen:
            continue
        seen.add(p["url"])
        uniq.append(p)
    return uniq


def search_hr_profiles(
    company: Optional[str] = None,
    roles: Optional[Iterable[str]] = None,
    location: Optional[str] = None,
    skills: Optional[Iterable[str]] = None,
    limit: int = 8,
) -> List[Dict[str, str]]:
    """Find public LinkedIn profile links for recruiters.

    Uses Bing web search to discover LinkedIn '/in/' profile URLs for recruiter queries.
    Returns a list of {label, url} objects, limited to `limit`.
    """
    roles_ = _clean(roles, 3) or ["recruiter"]
    skills_ = _clean(skills, 3)
    loc = (location or "").strip()

    queries: List[str] = []
    base_terms = ["recruiter", "technical recruiter", "university recruiter"]
    company_term = (company or "").strip()

    # Seed queries
    if company_term:
        for bt in base_terms:
            q = f"{bt} {company_term}"
            if loc:
                q += f" {loc}"
            queries.append(q)
    # Role/skill flavored
    for r in roles_:
        q = f"technical recruiter {r}"
        if company_term:
            q += f" {company_term}"
        if loc:
            q += f" {loc}"
        queries.append(q)
    if skills_:
        q = "technical recruiter " + " ".join(skills_)
        if company_term:
            q += f" {company_term}"
        if loc:
            q += f" {loc}"
        queries.append(q)

    # Execute queries until we collect enough
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    results: List[Dict[str, str]] = []
    seen = set()
    for q in queries:
        try:
            url = _bing_people_query(q)
            r = requests.get(url, headers=headers, timeout=7)
            if r.status_code != 200:
                continue
            items = _extract_profiles_from_html(r.text)
            for p in items:
                u = p.get("url")
                if not u or u in seen:
                    continue
                seen.add(u)
                results.append(p)
                if len(results) >= limit:
                    return results
        except Exception:
            continue
    return results[:limit]
