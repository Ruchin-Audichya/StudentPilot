from typing import List, Optional, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

try:
    from utils.linkedin_hr import generate_hr_search_links
    from utils.linkedin_profiles import search_hr_profiles
except Exception as e:  # pragma: no cover
    generate_hr_search_links = None
    search_hr_profiles = None
    _IMPORT_ERR = e
else:
    _IMPORT_ERR = None


router = APIRouter(prefix="/api/linkedin", tags=["linkedin-tools"])


class HRLinksRequest(BaseModel):
    resume_text: Optional[str] = None
    skills: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    location: Optional[str] = None
    limit: Optional[int] = 10


@router.post("/hr-links")
def hr_links(req: HRLinksRequest, request: Request) -> Dict:
    if _IMPORT_ERR:
        raise HTTPException(status_code=500, detail=f"linkedin tools unavailable: {_IMPORT_ERR}")
    # Prefer explicit inputs; otherwise attempt to read from server session state
    skills = req.skills or []
    roles = req.roles or []
    location = (req.location or "").strip() or None

    # Enrich from resume_text if provided and missing pieces
    if req.resume_text and (not skills or not roles or not location):
        try:
            import re
            text = re.sub(r"\s+", " ", req.resume_text).strip()
            tl = text.lower()
            tech = [
                "python","java","javascript","typescript","react","node","django","fastapi","sql","mongodb","aws","docker",
                "pandas","numpy","ml","machine learning","data science","flutter","android","ios"
            ]
            if not skills:
                found = []
                for t in tech:
                    if t in tl and t not in found:
                        found.append(t)
                skills = found[:6]
            if not roles:
                role_hints = ["software engineer","web developer","data analyst","data scientist","mobile developer"]
                roles = [r for r in role_hints if r in tl][:3] or ["software engineer"]
            if not location:
                m = re.search(r"(?:location|based in)\s*[:\-]?\s*([A-Za-z ,]+)", text, re.I)
                if m:
                    location = m.group(1).strip()
        except Exception:
            pass

    # Try session store from main app if still nothing provided explicitly
    if not (skills or roles or location):
        try:
            from main import _get_session_id, _get_session_profile  # type: ignore
            sid = _get_session_id(request)
            _text, profile = _get_session_profile(sid)
            skills = sorted(list(profile.get("skills", [])))
            roles = sorted(list(profile.get("roles", [])))
            location = location or profile.get("location")
        except Exception:
            pass

    links = generate_hr_search_links(skills=skills, roles=roles, location=location, limit=req.limit or 10)  # type: ignore
    return {"links": links, "from": "explicit" if (req.skills or req.roles or req.location) else ("resume_text" if req.resume_text else "session")}


class HRProfilesRequest(BaseModel):
    company: Optional[str] = None
    roles: Optional[List[str]] = None
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    limit: Optional[int] = 8


@router.post("/hr-profiles")
def hr_profiles(req: HRProfilesRequest, request: Request) -> Dict:
    if _IMPORT_ERR:
        raise HTTPException(status_code=500, detail=f"linkedin tools unavailable: {_IMPORT_ERR}")
    company = (req.company or "").strip() or None
    roles = req.roles or []
    location = (req.location or "").strip() or None
    skills = req.skills or []

    # Fallback to session profile if not provided
    if not (company or roles or location or skills):
        try:
            from main import _get_session_id, _get_session_profile  # type: ignore
            sid = _get_session_id(request)
            _text, profile = _get_session_profile(sid)
            roles = sorted(list(profile.get("roles", []))) or roles
            skills = sorted(list(profile.get("skills", []))) or skills
            location = location or profile.get("location")
        except Exception:
            pass

    items = search_hr_profiles(company=company, roles=roles, location=location, skills=skills, limit=req.limit or 8)  # type: ignore
    return {"profiles": items}


class HRProfilesBatchRequest(BaseModel):
    companies: List[str]
    roles: Optional[List[str]] = None
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    per_company_limit: Optional[int] = 3


@router.post("/hr-profiles/batch")
def hr_profiles_batch(req: HRProfilesBatchRequest, request: Request) -> Dict:
    if _IMPORT_ERR:
        raise HTTPException(status_code=500, detail=f"linkedin tools unavailable: {_IMPORT_ERR}")
    companies = [c.strip() for c in (req.companies or []) if c and c.strip()]
    if not companies:
        raise HTTPException(status_code=400, detail="companies array required")

    roles = req.roles or []
    location = (req.location or "").strip() or None
    skills = req.skills or []
    k = max(1, min(5, int(req.per_company_limit or 3)))

    from concurrent.futures import ThreadPoolExecutor, as_completed
    out = []
    with ThreadPoolExecutor(max_workers=min(6, len(companies))) as ex:
        futs = {ex.submit(search_hr_profiles, c, roles, location, skills, k): c for c in companies}  # type: ignore
        for fut in as_completed(futs):
            company = futs[fut]
            try:
                profs = fut.result() or []
            except Exception:
                profs = []
            out.append({"company": company, "profiles": profs})
    # Keep original order of companies in response
    order = {c: i for i, c in enumerate(companies)}
    out.sort(key=lambda x: order.get(x.get("company"), 1_000_000))
    return {"items": out}
