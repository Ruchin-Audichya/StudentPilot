from __future__ import annotations

import os
import json
from typing import List, Dict, Any, Optional

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


@router.post("/feeds")
def get_gov_feeds(f: GovFilter) -> Dict[str, Any]:
    items = _load_feed()
    if not items:
        return {"results": [], "count": 0}

    out: List[Dict[str, Any]] = []
    for it in items:
        if f.only_verified and not it.get("verified"):
            continue
        if f.state and (it.get("state") or "").lower() != f.state.lower():
            continue
        norm = {
            "source": "gov",
            "title": it.get("title") or "Internship",
            "company": it.get("org") or it.get("department") or "Government",
            "location": it.get("location") or (f.state or "India"),
            "stipend": it.get("stipend") or None,
            "apply_url": it.get("apply_url") or it.get("url") or None,
            "description": it.get("description") or "",
            "tags": list({"government", *(it.get("tags") or [])}),
            "score": _simple_score(it),
            "is_new": it.get("is_new", False),
            "verified": bool(it.get("verified", False)),
        }
        out.append(norm)

    # Sort by score desc; then limit
    out.sort(key=lambda x: (x.get("score") or 0), reverse=True)
    out = out[: f.limit]
    return {"results": out, "count": len(out)}
