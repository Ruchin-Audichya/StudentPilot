from __future__ import annotations

import os
import json
from typing import List, Dict, Any, Optional, Tuple
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/gov", tags=["government-feeds"])


class GovFilter(BaseModel):
    state: Optional[str] = Field(None, description="State filter e.g. 'Rajasthan'")
    only_verified: bool = Field(False, description="Return only verified items")
    limit: int = Field(50, ge=1, le=200)


def _load_feed() -> List[Dict[str, Any]]:
    here = os.path.dirname(__file__)
    data_path = os.path.normpath(os.path.join(here, "..", "data", "gov_feeds.json"))
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _simple_score(item: Dict[str, Any]) -> float:
    # Gentle heuristic score favoring paid, verified, recent-ish (if available), and internships with software keywords
    title = (item.get("title") or "").lower()
    desc = (item.get("description") or "").lower()
    score = 50.0
    if item.get("verified"):
        score += 15
    stipend = (item.get("stipend") or "").lower()
    if stipend and stipend not in {"0", "unpaid", "none", "na", "n/a"}:
        score += 10
    if any(k in title + " " + desc for k in ["software", "python", "react", "java", "ml", "data"]):
        score += 15
    # Cap 100
    return float(min(100.0, max(0.0, score)))


# --- Live fetch + cache (simple) ---
_CACHE: Dict[str, Any] = {"ts": 0.0, "items": []}
_TTL_SECONDS = 60 * 60 * 24  # 24 hours


def _is_verified_by_domain(url: Optional[str]) -> bool:
    if not url:
        return False
    try:
        host = urlparse(url).hostname or ""
        host = host.lower()
        # Strict government-owned domains
        if host.endswith(".gov.in") or host.endswith(".nic.in"):
            return True
        # Whitelist a few well-known official portals used in India
        whitelist = {
            "aicte-india.org",  # AICTE
            "niti.gov.in",      # NITI Aayog (covered by .gov.in anyway)
            "mygov.in",         # MyGov
            "bis.gov.in",       # BIS
            "drdo.gov.in",      # DRDO
            "mahaswayam.gov.in",# Maharashtra portal
        }
        return any(host == d or host.endswith("." + d) for d in whitelist)
    except Exception:
        return False


def _normalize(
    *,
    title: str,
    company: str,
    location: str,
    state: Optional[str],
    stipend: Optional[str],
    apply_url: Optional[str],
    description: str,
    tags: Optional[List[str]] = None,
    verified: Optional[bool] = None,
) -> Dict[str, Any]:
    item = {
        "source": "gov",
        "title": title or "Internship",
        "company": company or "Government",
        "location": location or (state or "India"),
        "stipend": stipend or None,
        "apply_url": apply_url,
        "description": description or "",
        "tags": list({"government", *(tags or [])}),
    }
    # Auto-verify by domain when not explicitly provided
    if verified is None:
        item["verified"] = _is_verified_by_domain(apply_url)
    else:
        item["verified"] = bool(verified)
    item["score"] = _simple_score(item)
    return item


def _page_meta(url: str, timeout: float = 10.0) -> Tuple[str, str]:
    """Fetch page title + meta description. Best-effort; returns (title, desc)."""
    try:
        r = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0 (compatible; StudentPilot/1.0)"})
        if r.status_code != 200:
            return "", ""
        soup = BeautifulSoup(r.text, "html.parser")
        title = (soup.title.string if soup.title and soup.title.string else "").strip()
        desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
        desc = (desc_tag.get("content") if desc_tag else "") or ""
        return title[:200], desc[:500]
    except Exception:
        return "", ""


def _fetch_aicte() -> List[Dict[str, Any]]:
    url = "https://internship.aicte-india.org/"
    title, desc = _page_meta(url)
    if not title and not desc:
        # Fallback minimal item
        desc = "AICTE Internship portal with government-backed internships."
    return [
        _normalize(
            title="AICTE Internship Portal",
            company="AICTE",
            location="India / Remote",
            state="All",
            stipend=None,
            apply_url=url,
            description=desc or title,
            tags=["aicte", "national"],
            verified=True,
        )
    ]


def _fetch_ncs() -> List[Dict[str, Any]]:
    url = "https://www.ncs.gov.in/"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "National Career Service portal; search for internships in government programs."
    return [
        _normalize(
            title="NCS Internship Listings",
            company="National Career Service",
            location="India",
            state="All",
            stipend=None,
            apply_url=url,
            description=desc or title,
            tags=["ncs", "government"],
            verified=True,
        )
    ]


def _fetch_mygov() -> List[Dict[str, Any]]:
    url = "https://innovateindia.mygov.in/internship/"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "MyGov Internship — opportunities on Digital India initiatives."
    return [
        _normalize(
            title="MyGov Internship",
            company="MyGov / MeitY",
            location="New Delhi / Remote",
            state="All",
            stipend="Role-dependent",
            apply_url=url,
            description=desc or title,
            tags=["mygov", "digital"],
            verified=True,
        )
    ]


def _fetch_drdo() -> List[Dict[str, Any]]:
    url = "https://www.drdo.gov.in/internship"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "DRDO Internship Program — research and engineering opportunities across labs."
    return [
        _normalize(
            title="DRDO Internship Program",
            company="DRDO",
            location="Across India",
            state="All",
            stipend="Role-dependent",
            apply_url=url,
            description=desc or title,
            tags=["drdo", "defence", "research"],
            verified=None,  # infer from domain
        )
    ]


def _fetch_niti() -> List[Dict[str, Any]]:
    url = "https://www.niti.gov.in/internship"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "NITI Aayog Internship — policy and research-focused internships."
    return [
        _normalize(
            title="NITI Aayog Internship",
            company="NITI Aayog",
            location="New Delhi / Remote",
            state="All",
            stipend="Unpaid / As per policy",
            apply_url=url,
            description=desc or title,
            tags=["niti", "policy", "research"],
            verified=None,
        )
    ]


def _fetch_mahaswayam() -> List[Dict[str, Any]]:
    url = "https://mahaswayam.gov.in/"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "MahaSwayam — Maharashtra Government's unified portal for jobs and internships."
    return [
        _normalize(
            title="MahaSwayam (Maharashtra)",
            company="Govt. of Maharashtra",
            location="Maharashtra, India",
            state="Maharashtra",
            stipend=None,
            apply_url=url,
            description=desc or title,
            tags=["maharashtra", "state", "portal"],
            verified=None,
        )
    ]


def _dedup(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set = set()
    out: List[Dict[str, Any]] = []
    for it in items:
        key = (it.get("title", "").strip().lower(), (it.get("company") or "").strip().lower(), (it.get("apply_url") or "").strip().lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


def _aggregate_live() -> List[Dict[str, Any]]:
    # Combine live fetchers with seed file
    items: List[Dict[str, Any]] = []
    try:
        items.extend(_fetch_aicte())
    except Exception:
        pass
    try:
        items.extend(_fetch_ncs())
    except Exception:
        pass
    try:
        items.extend(_fetch_mygov())
    except Exception:
        pass
    try:
        items.extend(_fetch_drdo())
    except Exception:
        pass
    try:
        items.extend(_fetch_niti())
    except Exception:
        pass
    try:
        items.extend(_fetch_mahaswayam())
    except Exception:
        pass

    # Bring in seeded examples as well (acts as fallback + examples)
    try:
        for it in _load_feed():
            items.append(
                _normalize(
                    title=it.get("title") or "Internship",
                    company=it.get("org") or it.get("department") or "Government",
                    location=it.get("location") or (it.get("state") or "India"),
                    state=it.get("state"),
                    stipend=it.get("stipend"),
                    apply_url=it.get("apply_url") or it.get("url"),
                    description=it.get("description") or "",
                    tags=(it.get("tags") or []),
                    verified=bool(it.get("verified", True)),
                )
            )
    except Exception:
        pass

    items = _dedup(items)
    # Score already computed in _normalize; sort here
    items.sort(key=lambda x: (x.get("score") or 0), reverse=True)
    return items


def _get_cached_items(force: bool = False) -> List[Dict[str, Any]]:
    now = time.time()
    if not force and _CACHE.get("items") and now - float(_CACHE.get("ts", 0.0)) < _TTL_SECONDS:
        return list(_CACHE["items"])  # shallow copy
    items = _aggregate_live()
    _CACHE["items"] = items
    _CACHE["ts"] = now
    return list(items)


@router.post("/feeds")
def get_gov_feeds(f: GovFilter) -> Dict[str, Any]:
    # Default endpoint keeps previous seed behavior but uses normalized path for consistency
    base_items: List[Dict[str, Any]] = []
    for it in _load_feed():
        norm = _normalize(
            title=it.get("title") or "Internship",
            company=it.get("org") or it.get("department") or "Government",
            location=it.get("location") or (it.get("state") or "India"),
            state=it.get("state"),
            stipend=it.get("stipend"),
            apply_url=it.get("apply_url") or it.get("url"),
            description=it.get("description") or "",
            tags=(it.get("tags") or []),
            verified=bool(it.get("verified", True)),
        )
        # keep is_new if present
        norm["is_new"] = it.get("is_new", False)
        base_items.append(norm)

    # Filtering
    out: List[Dict[str, Any]] = []
    for it in base_items:
        if f.only_verified and not it.get("verified"):
            continue
        if f.state and f.state.strip() and f.state.lower() not in (it.get("location", "").lower() + " " + (it.get("description", "").lower())):
            continue
        out.append(it)

    # Sort + limit
    out.sort(key=lambda x: (x.get("score") or 0), reverse=True)
    out = out[: f.limit]
    return {"results": out, "count": len(out)}


from fastapi import Query


@router.post("/feeds/live")
def get_gov_feeds_live(f: GovFilter, force: bool = Query(False, description="Bypass cache and refresh")) -> Dict[str, Any]:
    """Live aggregation with caching. Falls back internally to seeds if sources fail."""
    items = _get_cached_items(force=force)

    # Filter
    out: List[Dict[str, Any]] = []
    for it in items:
        if f.only_verified and not it.get("verified"):
            continue
        if f.state and f.state.strip():
            s = f.state.lower()
            blob = (it.get("location") or "").lower() + " " + (it.get("description") or "").lower() + " " + (it.get("title") or "").lower()
            if s not in blob:
                continue
        out.append(it)

    out.sort(key=lambda x: (x.get("score") or 0), reverse=True)
    out = out[: f.limit]
    return {"results": out, "count": len(out), "cached_at": _CACHE.get("ts", 0.0)}


@router.get("/feeds/cache-info")
def get_cache_info() -> Dict[str, Any]:
    return {
        "cached_at": _CACHE.get("ts", 0.0),
        "ttl_seconds": _TTL_SECONDS,
        "items": len(_CACHE.get("items", [])),
    }
