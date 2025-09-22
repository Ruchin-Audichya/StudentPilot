from __future__ import annotations

import os
import json
from typing import List, Dict, Any, Optional, Tuple
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/v1/gov", tags=["gov-feeds"])


class GovFilter(BaseModel):
    state: Optional[str] = Field(None, description="State filter e.g. 'Rajasthan'")
    only_verified: bool = Field(False, description="Return only verified items")
    limit: int = Field(50, ge=1, le=200)


def _simple_score(item: Dict[str, Any]) -> float:
    # baseline score: verified domains + stipend hint + internship keyword + recency (if present)
    score = 0.0
    url = (item.get("apply_url") or item.get("url") or "").lower()
    host = urlparse(url).netloc
    if any(k in host for k in ("aicte", "ncs.gov", "mygov", "drdo", "isro", "gov.in", "nic.in")):
        score += 20
    title = (item.get("title") or "").lower()
    desc = (item.get("description") or "").lower()
    if "intern" in title or "internship" in title or "internship" in desc:
        score += 10
    if (item.get("stipend") or "").strip():
        score += 5
    # trust bump
    if item.get("verified"):
        score += 10
    return score


def _is_verified_by_domain(url: Optional[str]) -> bool:
    if not url:
        return False
    host = urlparse(url).netloc.lower()
    return any(host.endswith(k) for k in (".gov.in", ".nic.in")) or any(k in host for k in ("aicte", "ncs.gov", "mygov", "drdo", "isro"))


def _normalize(*, title: str, company: str, location: str, state: Optional[str], stipend: Optional[str], apply_url: Optional[str], description: str, tags: Optional[List[str]] = None, verified: Optional[bool] = None) -> Dict[str, Any]:
    item = {
        "title": title.strip(),
        "company": company.strip(),
        "location": location.strip() or (state or "India"),
        "state": state,
        "stipend": stipend,
        "apply_url": apply_url,
        "description": description.strip(),
        "tags": tags or [],
        "verified": bool(verified) if verified is not None else _is_verified_by_domain(apply_url),
    }
    item["score"] = _simple_score(item)
    # Simple trust score mirroring score for now (0..100 scale)
    item["trust_score"] = min(100.0, max(0.0, item["score"]))
    return item


def _page_meta(url: str, timeout: float = 10.0) -> Tuple[str, str]:
    """Fetch page title + meta description. Best-effort; returns (title, desc)."""
    try:
        r = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        title = (soup.title.string.strip() if soup.title and soup.title.string else "")
        desc = ""
        m = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
        if m and m.get("content"):
            desc = m["content"].strip()
        return title, desc
    except Exception:
        return "", ""


# --- Source fetchers (lightweight; no deep scraping) ---
def _fetch_aicte() -> List[Dict[str, Any]]:
    url = "https://internship.aicte-india.org/"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "AICTE internship portal."
    return [
        _normalize(
            title="AICTE Internship Portal",
            company="AICTE",
            location="India",
            state="All",
            stipend=None,
            apply_url=url,
            description=desc or title,
            tags=["aicte","portal"],
            verified=True,
        )
    ]


def _fetch_ncs() -> List[Dict[str, Any]]:
    url = "https://www.ncs.gov.in/"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "National Career Service portal; search internships."
    return [
        _normalize(
            title="NCS Internship Listings",
            company="National Career Service",
            location="India",
            state="All",
            stipend=None,
            apply_url=url,
            description=desc or title,
            tags=["ncs","government"],
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
            tags=["mygov","digital"],
            verified=True,
        )
    ]


def _fetch_drdo() -> List[Dict[str, Any]]:
    url = "https://www.drdo.gov.in/careers"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "DRDO careers and internships page."
    return [
        _normalize(
            title="DRDO Internships",
            company="DRDO",
            location="India",
            state="All",
            stipend=None,
            apply_url=url,
            description=desc or title,
            tags=["drdo","defence"],
            verified=True,
        )
    ]


def _fetch_niti() -> List[Dict[str, Any]]:
    url = "https://www.niti.gov.in/internship"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "NITI Aayog internship program."
    return [
        _normalize(
            title="NITI Aayog Internship",
            company="NITI Aayog",
            location="New Delhi / Remote",
            state="All",
            stipend=None,
            apply_url=url,
            description=desc or title,
            tags=["niti","policy"],
            verified=True,
        )
    ]


def _fetch_mahaswayam() -> List[Dict[str, Any]]:
    url = "https://mahaswayam.gov.in/"
    title, desc = _page_meta(url)
    if not title and not desc:
        desc = "MahaSwayam — Maharashtra Government's unified jobs portal."
    return [
        _normalize(
            title="MahaSwayam (Maharashtra)",
            company="Govt. of Maharashtra",
            location="Maharashtra, India",
            state="Maharashtra",
            stipend=None,
            apply_url=url,
            description=desc or title,
            tags=["maharashtra","state","portal"],
            verified=None,
        )
    ]


def _aggregate_live() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for f in (_fetch_aicte, _fetch_ncs, _fetch_mygov, _fetch_drdo, _fetch_niti, _fetch_mahaswayam):
        try:
            items.extend(f())
        except Exception:
            pass
    # Dedup by apply_url
    seen = set()
    out: List[Dict[str, Any]] = []
    for it in items:
        k = (it.get("apply_url") or it.get("url") or "").strip()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(it)
    # sort by baseline score desc
    out.sort(key=lambda x: (x.get("score") or 0), reverse=True)
    return out


# cache results to avoid hammering portals
_CACHE: Dict[str, Any] = {"ts": 0.0, "items": []}
_TTL_SECONDS = 60 * 60 * 12  # 12 hours


def _get_cached_items(force: bool = False) -> List[Dict[str, Any]]:
    now = time.time()
    if (not force) and _CACHE["items"] and (now - _CACHE["ts"] < _TTL_SECONDS):
        return list(_CACHE["items"])  # copy
    items = _aggregate_live()
    _CACHE["items"] = items
    _CACHE["ts"] = now
    return list(items)


def _score_with_session(items: List[Dict[str, Any]], request: Request) -> List[Dict[str, Any]]:
    """Use resume profile from session (if any) to boost scores (server-side)."""
    try:
        from ..main import _get_session_id, _get_session_profile  # type: ignore
    except Exception:
        # Relative import fallback when executed as module
        try:
            from main import _get_session_id, _get_session_profile  # type: ignore
        except Exception:
            _get_session_id = None  # type: ignore
            _get_session_profile = None  # type: ignore

    if not _get_session_id or not _get_session_profile:
        return items

    sid = _get_session_id(request)
    _, profile = _get_session_profile(sid)
    skills = [s for s in list(profile.get("skills", [])) if s][:25]
    roles = [r for r in list(profile.get("roles", [])) if r][:8]
    loc = (profile.get("location") or "").lower()

    def boost(it: Dict[str, Any]) -> float:
        text = f"{it.get('title','')} {it.get('description','')}".lower()
        hit = len({s for s in skills if s and s in text})
        role_hit = any(r for r in roles if r and r in text)
        loc_hit = (loc and loc in (it.get('location') or '').lower())
        return (hit * 2.0) + (3.0 if role_hit else 0.0) + (1.0 if loc_hit else 0.0)

    for it in items:
        it["score"] = (it.get("score") or 0) + boost(it)
    items.sort(key=lambda x: (x.get("score") or 0), reverse=True)
    return items


@router.post("/feeds")
def get_gov_feeds(f: GovFilter) -> Dict[str, Any]:
    """Seeded fallback endpoint: returns cached live set (if present) else static minimal items.

    The minimal static items ensure UI doesn't break when network is blocked.
    """
    try:
        items = _get_cached_items(force=False)
    except Exception:
        items = []
    if not items:
        items = [
            _normalize(title="Digital India Innovation Challenge", company="MeitY", location="India", state="All", stipend=None, apply_url="https://www.meity.gov.in/", description="MeitY innovation challenges.", tags=["digital"], verified=True),
            _normalize(title="AI Research Fellowship", company="DST", location="India", state="All", stipend=None, apply_url="https://dst.gov.in/", description="DST research fellowships.", tags=["research"], verified=True),
            _normalize(title="Student Startup Seed Support", company="MSDE", location="India", state="All", stipend=None, apply_url="https://msde.gov.in/", description="MSDE support programs.", tags=["startup"], verified=True),
        ]

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
    return {"results": out, "count": len(out)}


@router.post("/feeds/live")
def get_gov_feeds_live(f: GovFilter, request: Request, force: bool = Query(False, description="Bypass cache and refresh")) -> Dict[str, Any]:
    """Live aggregation with caching and resume-aware scoring from session."""
    items = _get_cached_items(force=force)
    # Session-aware boost
    items = _score_with_session(items, request)

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
    return {"cached_at": _CACHE.get("ts", 0.0), "ttl": _TTL_SECONDS}
