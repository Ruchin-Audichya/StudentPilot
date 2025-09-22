# main.py - Full Feature + Speed + Variety + Buzzword Expansion
# deploy-marker: update to trigger redeploy and ensure latest backend is live

import os
try:
    # Auto-load environment variables from the nearest .env (repo root or parent) for easier setup.
    from dotenv import load_dotenv, find_dotenv  # type: ignore
    env_path = find_dotenv(usecwd=True)
    load_dotenv(env_path or None)
except Exception:
    pass
import io
import csv
import re
# Optional PDF parsing dependency
try:
    import fitz  # PyMuPDF
    _PDF_ENABLED = True
except Exception:
    fitz = None  # type: ignore
    _PDF_ENABLED = False
try:
    import docx  # type: ignore
    _DOCX_ENABLED = True
except Exception:
    docx = None  # type: ignore
    _DOCX_ENABLED = False
from typing import List, Dict, Optional
from fastapi import FastAPI, File, UploadFile
from fastapi import HTTPException
from fastapi import Request
from fastapi import Response
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor, as_completed, wait, FIRST_COMPLETED
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

# Safe import for scraper (never break app startup on EB)
try:
    from scrapers.internshala import fetch_internships  # type: ignore
except Exception:  # pragma: no cover - fallback path
    def fetch_internships(*args, **kwargs):  # type: ignore
        return []
# LinkedIn scraper (Selenium) is imported lazily only if enabled to avoid heavy startup + Chromium deps.
def _maybe_import_linkedin():
    try:
        from scrapers.linkedin import fetch_linkedin_internships  # type: ignore
        return fetch_linkedin_internships
    except Exception:
        return lambda *a, **k: []  # graceful no-op

# Company careers scraper integration
try:
    from routes.company_scraper import scrape_company_careers  # type: ignore
except Exception:
    scrape_company_careers = None  # type: ignore

# Small curated map of well-known companies -> careers roots (ATS-hosted where possible)
_CURATED_CAREERS = [
    # NVIDIA (Workday hosted board)
    "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/",
    # Google internships filter
    "https://careers.google.com/jobs/results/?employment_type=INTERN",
    # Microsoft search for interns
    "https://jobs.careers.microsoft.com/global/en/search?q=intern",
    # Deloitte SmartRecruiters (global)
    "https://careers.smartrecruiters.com/Deloitte",
]

# Richer curated careers with lightweight metadata for resume-aware selection
_CURATED_CAREERS_META = [
    {"company": "NVIDIA", "url": "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/", "roles": ["software","ml","hardware"], "skills": ["python","cuda","ml","deep","c++"], "regions": ["global"]},
    {"company": "Google", "url": "https://careers.google.com/jobs/results/?employment_type=INTERN", "roles": ["software","data","ml","web"], "skills": ["python","java","react","ml"], "regions": ["global"]},
    {"company": "Microsoft", "url": "https://jobs.careers.microsoft.com/global/en/search?q=intern", "roles": ["software","data","cloud","web"], "skills": ["c#","azure","python","react"], "regions": ["global"]},
    {"company": "Deloitte", "url": "https://careers.smartrecruiters.com/Deloitte", "roles": ["data","analytics","consulting"], "skills": ["excel","powerbi","sql","python"], "regions": ["global","india"]},
    {"company": "Infosys", "url": "https://careers.infosys.com/jobs/Search?query=intern", "roles": ["software","web","data"], "skills": ["java","python","react"], "regions": ["india","global"]},
    {"company": "TCS", "url": "https://www.tcs.com/careers/students/internships", "roles": ["software","web","data"], "skills": ["java","python","cloud"], "regions": ["india"]},
    {"company": "Wipro", "url": "https://careers.wipro.com/careers-home/jobs?keyword=intern", "roles": ["software","web","data"], "skills": ["java","python","cloud"], "regions": ["india"]},
    {"company": "Amazon", "url": "https://www.amazon.jobs/en/search?base_query=intern&category=software-development", "roles": ["software","web","cloud"], "skills": ["java","aws","react","python"], "regions": ["global"]},
    {"company": "Meta", "url": "https://www.metacareers.com/jobs/?q=intern", "roles": ["software","ml","web"], "skills": ["react","python","ml"], "regions": ["global"]},
    {"company": "Adobe", "url": "https://careers.adobe.com/us/en/search-results?q=intern", "roles": ["software","design","web"], "skills": ["javascript","react","python"], "regions": ["global"]},
]

def _normalize_role_tokens(roles):
    tokens = set()
    for r in (roles or []):
        rl = str(r).lower()
        if any(k in rl for k in ("software","sde","developer","engineering","engineer","programmer","backend","frontend","fullstack")):
            tokens.add("software")
        if any(k in rl for k in ("data","analyst","analytics","bi","business intelligence","ds","scientist")):
            tokens.add("data")
        if any(k in rl for k in ("ml","machine learning","ai","deep")):
            tokens.add("ml")
        if any(k in rl for k in ("web","frontend","react","javascript","typescript","ui","ux")):
            tokens.add("web")
        if any(k in rl for k in ("cloud","devops","aws","azure","gcp","kubernetes","docker")):
            tokens.add("cloud")
        if any(k in rl for k in ("design","designer","ui","ux")):
            tokens.add("design")
    return tokens

def _select_curated_careers(profile: dict, location: str, max_sites: int = 4):
    """Pick a handful of company careers based on resume roles/skills/location.

    Scoring:
      +2 per matching normalized role token
      +1 per overlapping skill keyword
      +1 if region hint matches (e.g., 'india' in location and site regions)
    """
    try:
        roles = list(profile.get("roles", []))
        skills = [str(s).lower() for s in list(profile.get("skills", []))]
        role_tokens = _normalize_role_tokens(roles)
        loc_l = (location or "").lower()
        region_hint = "india" if "india" in loc_l else None
        scored = []
        for site in _CURATED_CAREERS_META:
            score = 0
            # roles
            for t in role_tokens:
                if t in site.get("roles", []):
                    score += 2
            # skills
            for s in skills[:10]:
                if s in site.get("skills", []):
                    score += 1
            # region
            if region_hint and region_hint in site.get("regions", []):
                score += 1
            # baseline slight preference to global brands
            if not region_hint and "global" in site.get("regions", []):
                score += 1
            scored.append((score, site["url"]))
        scored.sort(key=lambda x: x[0], reverse=True)
        # Keep only those with positive score, else fallback to legacy curated list
        selected = [u for (s,u) in scored if s > 0][:max_sites]
        return selected or _CURATED_CAREERS[:max_sites]
    except Exception:
        return _CURATED_CAREERS[:max_sites]

# -----------------------------
# AI / OpenRouter Configuration
# -----------------------------
def _openrouter_config():
    """Fetch OpenRouter-related env vars dynamically so key changes don't require process restart."""
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    # Sensible defaults with a few free fallbacks (first wins). Can be overridden via OPENROUTER_MODELS.
    default_models = "deepseek/deepseek-chat-v3-0324:free,deepseek/deepseek-chat:free,meta-llama/llama-3.1-8b-instruct:free,gryphe/mythomax-l2-13b:free"
    models = [m.strip() for m in os.getenv("OPENROUTER_MODELS", default_models).split(",") if m.strip()]
    base = os.getenv("OPENROUTER_BASE", "https://openrouter.ai/api/v1/chat/completions").strip()
    # Prefer configured frontend origin so HTTP-Referer is a real site; fallback to Render URL.
    site_url = (
        os.getenv("OPENROUTER_SITE_URL", "").strip()
        or os.getenv("FRONTEND_ORIGIN", "").strip()
    or "https://studentpilot.onrender.com"
    )
    site_name = os.getenv("OPENROUTER_SITE_NAME", "Find My Stipend").strip() or "Find My Stipend"
    return key, models, base, site_url, site_name
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()  # (Future fallback)

# Allow disabling heavier LinkedIn Selenium scraper (e.g. on platforms without Chromium)
DISABLE_LINKEDIN = os.getenv("DISABLE_LINKEDIN", "0") in {"1", "true", "yes", "on"}

# -----------------------------
# App Setup
# -----------------------------
app = FastAPI()
# Root welcome route so EB doesn't show default placeholder page
@app.get("/")
def root():
    return {"app": "Find My Stipend API", "health": "/health", "endpoints": ["/api/search", "/api/upload-resume", "/api/chat"], "status": "ok"}
# Mount modular routers
try:
    from routes.company_scraper import router as company_scraper_router  # type: ignore
    app.include_router(company_scraper_router)
except Exception:
    # Router is optional; app must still boot even if import fails in constrained envs
    pass
try:
    from routes.linkedin_tools import router as linkedin_tools_router  # type: ignore
    app.include_router(linkedin_tools_router)
except Exception:
    pass
try:
    from routes.resume_analyzer import router as resume_analyzer_router  # type: ignore
    app.include_router(resume_analyzer_router)
except Exception:
    pass
try:
    from routes.messages import router as messages_router  # type: ignore
    app.include_router(messages_router)
except Exception:
    pass
try:
    from routes.recommendations import router as recommendations_router  # type: ignore
    app.include_router(recommendations_router)
except Exception:
    pass
try:
    from routes.portfolio import router as portfolio_router  # type: ignore
    app.include_router(portfolio_router)
except Exception:
    pass
try:
    from routes.gov_feeds import router as gov_feeds_router  # type: ignore
    app.include_router(gov_feeds_router)
except Exception:
    pass
try:
    from routes.testimonials import router as testimonials_router  # type: ignore
    app.include_router(testimonials_router)
except Exception:
    pass
try:
    from routes.mock_interview import router as mock_interview_router  # type: ignore
    app.include_router(mock_interview_router)
except Exception:
    pass
# CORS: default to permissive for public API usage; can be restricted via env if needed.
_cors_env = os.getenv("CORS_ORIGINS", "").strip()
if _cors_env:
    # Respect explicit origins when provided (comma-separated)
    allowed_origins = [o.strip().rstrip('/') for o in _cors_env.split(',') if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )
else:
    # Fully open CORS (no credentials) to avoid preflight issues with custom headers like X-Session-Id
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )

# Simple logging middleware (enabled when DEBUG_LOG=1)
if os.getenv("DEBUG_LOG", "0") in {"1","true","yes"}:
    import time, logging
    logging.basicConfig(level=logging.INFO)
    @app.middleware("http")
    async def _log_requests(request, call_next):
        start = time.time()
        response = None
        try:
            response = await call_next(request)
            return response
        finally:
            dur_ms = (time.time()-start)*1000
            logging.info("%s %s -> %s %.1fms", request.method, request.url.path, getattr(response,'status_code', '?'), dur_ms)

# Basic health check for load balancers / EB
@app.get("/health")
def health_check():
    """Fast health endpoint (no scraping, disk, or network) for EB / load balancers."""
    return {"status": "ok"}

# Robust preflight handler to avoid 400s from strict middleware validation on some clients
@app.options("/{rest_of_path:path}")
def any_options(request: Request):
    origin = request.headers.get("origin") or "*"
    acrm = request.headers.get("access-control-request-method") or "*"
    acrh = request.headers.get("access-control-request-headers") or "*"
    # If explicit CORS_ORIGINS configured, prefer reflecting the incoming origin only when present
    allow_origin = origin if _cors_env else "*"
    headers = {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": acrh,
        "Access-Control-Max-Age": "600",
    }
    return Response(status_code=204, headers=headers)

@app.get("/version")
def version_info():
    """Lightweight version & config surface for frontend debugging (no secrets)."""
    return {
        "status": "ok",
        "version": os.getenv("RELEASE", "dev"),
        "commit": os.getenv("GIT_SHA", "unknown"),
    "backend": "findmystipend",
        "openrouter": bool(os.getenv("OPENROUTER_API_KEY", "").strip()),
    }

@app.post("/api/session")
def create_session(request: Request):
    """Issue a random session id for clients that prefer server-generated IDs.

    Frontend may also generate its own UUID and just send it in X-Session-Id; this endpoint is optional.
    """
    import uuid
    sid = uuid.uuid4().hex
    _sessions.setdefault(sid, {"resume_text": "", "resume_profile": {"skills": set(), "roles": set(), "location": None}})
    return {"session_id": sid}

# Legacy globals (kept for backward-compat and local single-user dev)
resume_text = ""
resume_profile = {"skills": set(), "roles": set(), "location": None}

# Per-session store to prevent cross-user leakage. Keys are arbitrary session IDs provided by the client.
# This avoids global sharing of resume context across users.
_sessions: Dict[str, Dict] = {}

def _get_session_id(request: Request) -> Optional[str]:
    # Prefer explicit header; tolerate common variants
    sid = request.headers.get("x-session-id") or request.headers.get("X-Session-Id")
    if sid:
        sid = sid.strip()
    return sid or None

def _get_session_profile(session_id: Optional[str]):
    """Return (resume_text, resume_profile_dict) for given session id.

    If session_id is None or not found, return empty defaults to avoid leakage.
    """
    if not session_id:
        return "", {"skills": set(), "roles": set(), "location": None}
    entry = _sessions.get(session_id)
    if not entry:
        return "", {"skills": set(), "roles": set(), "location": None}
    return entry.get("resume_text", ""), entry.get("resume_profile", {"skills": set(), "roles": set(), "location": None})
buzzword_skills = set()
buzzword_roles = set()

# -----------------------------
# Load Buzzwords CSV
# -----------------------------
# Prefer the repository path under backend/data/, fall back to legacy location
_here = os.path.dirname(__file__)
csv_path = os.path.join(_here, "data", "btech_buzzwords.csv")
if not os.path.exists(csv_path):
    csv_path = os.path.join(_here, "btech_buzzwords.csv")
if os.path.exists(csv_path):
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if "Required_Skills" in row and row["Required_Skills"]:
                for skill in row["Required_Skills"].split(","):
                    buzzword_skills.add(skill.strip().lower())
            if "Role_Hints" in row and row["Role_Hints"]:
                for role in row["Role_Hints"].split(","):
                    buzzword_roles.add(role.strip().lower())

# -----------------------------
# Helpers
# -----------------------------
def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())

def _extract_keywords(text: str, max_terms=8):
    found = []
    text_l = text.lower()
    for bw in buzzword_skills:
        if bw in text_l and bw not in found:
            found.append(bw)
        if len(found) >= max_terms:
            break
    return found

def _extract_roles(text: str):
    roles = []
    for role in list(buzzword_roles) + [
        "software engineer", "backend", "frontend",
        "full stack", "data analyst", "data scientist"
    ]:
        if role in text.lower() and role not in roles:
            roles.append(role)
    return roles

def _extract_location(text: str):
    match = re.search(r"(?:location|based in)\s*[:\-]?\s*([A-Za-z ,]+)", text, re.I)
    if match:
        return _normalize(match.group(1))
    return None

def _extract_email(text: str) -> Optional[str]:
    m = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
    return m.group(0) if m else None

def _extract_phone(text: str) -> Optional[str]:
    m = re.search(r"(\+?\d[\d\-() ]{7,}\d)", text)
    return _normalize(m.group(1)) if m else None

def _extract_name(text: str) -> Optional[str]:
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    for l in lines[:8]:
        if "@" in l or len(l.split()) > 8:
            continue
        words = l.split()
        if 1 < len(words) <= 5 and all(w[0:1].isalpha() for w in words):
            cand = " ".join(w.capitalize() for w in words)
            return cand
    m = re.search(r"name\s*[:\-]\s*([A-Za-z ]{3,})", (text or ""), re.I)
    return _normalize(m.group(1)) if m else None

def _tag_new(posted: Optional[str]) -> bool:
    if not posted:
        return False
    posted_l = posted.lower()
    if "today" in posted_l or "just now" in posted_l:
        return True
    match = re.search(r"(\d+)\s+day", posted_l)
    if match:
        return int(match.group(1)) <= 7
    return False

def _enhance_user_query_for_tech(query: str) -> str:
    """
    Enhance user search query to be more tech/B.Tech focused.
    """
    query_lower = query.lower()
    
    # If already tech-focused, return as-is
    tech_indicators = ["software", "developer", "programming", "tech", "engineer", "data", "web", "mobile"]
    if any(indicator in query_lower for indicator in tech_indicators):
        return query
    
    # Domain-specific enhancements
    if "python" in query_lower:
        return "python developer internship"
    elif "java" in query_lower:
        return "java developer internship"
    elif "web" in query_lower:
        return "web developer internship"
    elif "data" in query_lower:
        return "data science internship"
    elif "ai" in query_lower or "ml" in query_lower:
        return "machine learning internship"
    elif query_lower in ["internship", "intern", "job"]:
        return "software engineer internship"
    
    # Default: add tech context
    return f"software {query}"

def _score_job(job: Dict, profile: Dict) -> float:
    """Heuristic scoring blending resume skill/role overlap and job text.

    Components:
    - Skill coverage ratio: overlap of resume skills with job text (title+desc)
    - Term density: distinct resume terms appearing
    - Role match: direct role keyword present
    - Location alignment: location keyword match
    - Paid signal: stipend present
    """
    job_text = f"{job.get('title','')} {job.get('description','')}".lower()
    resume_skills = list(profile.get("skills", []))[:25]
    resume_roles = list(profile.get("roles", []))[:8]
    loc = (profile.get("location") or "").lower()

    # Overlap
    skill_hits = [s for s in resume_skills if s and s in job_text]
    distinct_hits = set(skill_hits)
    coverage = (len(distinct_hits) / max(1, len(resume_skills))) if resume_skills else 0

    role_hit = any(r for r in resume_roles if r and r in job_text)

    base = 40.0
    base += min(25.0, coverage * 25.0)            # up to +25
    base += min(20.0, len(distinct_hits) * 3.0)    # distinct term richness
    if role_hit:
        base += 10
    if loc and loc in (job.get("location", "").lower()):
        base += 5
    if job.get("stipend"):
        base += 3
    return max(5.0, min(100.0, base))

def _dedupe(jobs: List[Dict]) -> List[Dict]:
    seen = set()
    out = []
    for job in jobs:
        key = (job.get("apply_url") or "").split("?")[0].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(job)
    return out

# -----------------------------
# AI Helper (OpenRouter)
# -----------------------------
import json, requests as _requests
# Track last AI error (for diagnostics)
_LAST_AI_ERROR: Optional[str] = None
def _ai_enhanced_response(
    user_message: str,
    resume_text: str,
    profile: Dict,
    preferred_model: Optional[str] = None,
    referer_override: Optional[str] = None,
    site_name_override: Optional[str] = None,
) -> str:
    key, models, base, site_url, site_name = _openrouter_config()
    if not key or not user_message.strip():
        return ""
    # If client provided a model, try it first
    if preferred_model:
        pm = preferred_model.strip()
        if pm and pm not in models:
            models = [pm] + models
    # Use runtime overrides from the current request when available
    if referer_override:
        site_url = referer_override.strip() or site_url
    if site_name_override:
        site_name = site_name_override.strip() or site_name
    system_prompt = (
        "You are Find My Stipend—an internship and resume mentor. Be concrete, kind, and helpful.\n"
        "STYLE:\n"
        "- Human-sounding, positive, and specific.\n"
        "- Use clean Markdown: bullets (- ), numbered lists, and **bold** sparingly.\n"
        "- Avoid boilerplate and disclaimers.\n"
        "- Never reveal chain-of-thought.\n\n"
        "ADAPTIVE LENGTH & FORMAT RULES:\n"
        "- If the user asks for 'short', 'one line', or says 'nothing else', return only the minimal requested content.\n"
        "- If the user says 'rate my resume out of 10' and 'nothing else', return just a rating like '8/10' with no extra text.\n"
        "- If the user asks for 'long' or 'detailed', provide richer bullets (5–8 items) with explanations.\n"
        "- Otherwise default to concise sections.\n\n"
        "DEFAULT SECTIONS (when a full answer is appropriate):\n"
        "🎯 Summary\n"
        "🧩 Skill Gaps (if any)\n"
        "🔧 Improvements (clear next steps)\n"
        "🧭 Roles & Keywords to target\n"
        "📌 Extras (links, ideas)\n"
        "💡 Tip\n"
    )
    profile_snippet = {
        "skills": sorted(list(profile.get("skills", [])))[:25],
        "roles": sorted(list(profile.get("roles", [])))[:10],
        "location": profile.get("location"),
    }
    resume_excerpt = (resume_text or "")[:4000]
    # Heuristic: adapt generation settings to user intent
    um = (user_message or "").lower()
    short_hint = any(k in um for k in ["short", "one line", "one-line", "nothing else"])
    wants_rating_only = ("out of 10" in um and "nothing else" in um) or re.search(r"\b(\d+\s*/\s*10)\b", um)
    long_hint = any(k in um for k in ["long", "detailed", "elaborate"]) and not short_hint

    temp = 0.7
    max_toks = 500
    if wants_rating_only:
        temp = 0.4
        max_toks = 30
    elif short_hint:
        temp = 0.6
        max_toks = 120
    elif long_hint:
        temp = 0.8
        max_toks = 700

    # Add an explicit mode hint for the assistant
    mode_hint = "MODE: rating-only (just 'X/10')." if wants_rating_only else (
        "MODE: short." if short_hint else ("MODE: long/detail." if long_hint else "MODE: default."))

    for model in models:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{mode_hint}\nUser message: {user_message}\nProfile: {json.dumps(profile_snippet)}\nResume excerpt: {resume_excerpt}"},
            ],
            "temperature": temp,
            "max_tokens": max_toks,
        }
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "HTTP-Referer": site_url,
            "X-Title": site_name,
        }
        try:
            resp = _requests.post(base, json=payload, headers=headers, timeout=40)
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices") or []
            if choices:
                content = choices[0].get("message", {}).get("content")
                if content:
                    # Ensure line breaks and emojis are preserved
                    content = re.sub(r'([\n\r]+)', '\n', content)
                    content = re.sub(r'\n{2,}', '\n', content)
                    # Add extra spacing after emoji sections
                    content = re.sub(r'(\n[🎯🕳️🔧👍👎⭐💡])', '\n\1', content)
                    return content.strip()
        except Exception as e:
            if os.getenv("AI_DEBUG", "0") in {"1","true","yes"}:
                import traceback, logging
                logging.basicConfig(level=logging.INFO)
                logging.error(f"OpenRouter call failed for model {model}: %s", e)
                logging.error("Trace: %s", traceback.format_exc())
            # Save a compact error for diagnostics
            try:
                import requests as __r
                if isinstance(e, __r.exceptions.HTTPError) and getattr(e, 'response', None) is not None:
                    body = e.response.text[:500]
                    status = e.response.status_code
                    _set_last_ai_error(f"HTTP {status}: {body}")
                else:
                    _set_last_ai_error(str(e)[:300])
            except Exception:
                _set_last_ai_error(str(e)[:300])
            continue
    # If OpenRouter failed across all models, try Gemini as a transparent fallback (when configured)
    try:
        if GOOGLE_API_KEY:
            # Build a compact prompt reusing the same mode and context
            combined = (
                f"{system_prompt}\n\n{mode_hint}\n"
                f"User message: {user_message}\n"
                f"Profile: {json.dumps(profile_snippet)}\n"
                f"Resume excerpt: {resume_excerpt}"
            )
            payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": combined}]}
                ],
                "generationConfig": {
                    "temperature": temp,
                    "maxOutputTokens": max_toks
                }
            }
            # Use fast, low-cost model
            g_model = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")
            g_resp = _gemini_generate_content(g_model, payload)
            # Extract text
            text = None
            try:
                cands = (g_resp or {}).get("candidates") or []
                if cands:
                    parts = (((cands[0] or {}).get("content") or {}).get("parts")) or []
                    # Concatenate all text parts
                    texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
                    text = "\n".join(texts).strip() if texts else None
            except Exception:
                text = None
            if text:
                return text
    except Exception as _e:
        # Preserve last OpenRouter error; don't overwrite with Gemini specifics
        if os.getenv("AI_DEBUG", "0") in {"1","true","yes"}:
            import logging
            logging.basicConfig(level=logging.INFO)
            logging.error("Gemini fallback failed: %s", _e)
    return ""

def _set_last_ai_error(msg: Optional[str]):
    global _LAST_AI_ERROR
    _LAST_AI_ERROR = (msg or "").strip() or None

# -----------------------------
# Google Generative Language (Gemini) lightweight proxy
# -----------------------------
def _gemini_generate_content(model: str, payload: Dict) -> Dict:
    """Server-side call to Google Generative Language API using GOOGLE_API_KEY.

    This avoids exposing the key to the browser and allows frontend fallback when Vite env is missing.
    Returns raw JSON from Google API.
    """
    key = GOOGLE_API_KEY
    if not key:
        raise HTTPException(status_code=400, detail="GOOGLE_API_KEY not set on backend")
    model = (model or "gemini-2.5-flash").strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    try:
        resp = _requests.post(url, json=payload, timeout=40)
        if resp.status_code == 429:
            # Light backoff retry once for rate limits
            import time
            time.sleep(1.0)
            resp = _requests.post(url, json=payload, timeout=40)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini proxy failed: {e}")

@app.post("/api/gemini/generate")
async def gemini_generate(request: Request):
    """Generic proxy for Gemini generateContent.

    Body example (mirrors Google API):
    {
      "model": "gemini-2.5-flash",
      "contents": [...],
      "generationConfig": {...},
      "safetySettings": {...}
    }
    """
    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    model = data.get("model") or "gemini-2.5-flash"
    # Forward entire body except 'model' (Google expects model in path)
    forward_payload = data.copy()
    forward_payload.pop("model", None)
    result = _gemini_generate_content(model, forward_payload)
    return result

@app.get("/api/ai-test")
def ai_test(request: Request, safe: bool = False):
    """Quick diagnostic to verify OpenRouter connectivity (no resume context).

    Never throws; returns ok=false with error details on failure.
    """
    try:
        key, models, *_ = _openrouter_config()
        if safe:
            return {
                "ok": True,
                "mode": "safe",
                "key_present": bool(key),
                "model": models[:1],
                "last_error": _LAST_AI_ERROR,
            }
        if not key:
            return {"ok": False, "reason": "OPENROUTER_API_KEY not set in environment"}
        sample = _ai_enhanced_response("Return one word: ping", "", {})
        return {"ok": bool(sample), "sample": sample or None, "model": models[:1], "last_error": _LAST_AI_ERROR}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300], "last_error": _LAST_AI_ERROR}

# -----------------------------
# Models
# -----------------------------
class Filters(BaseModel):
    location: Optional[str] = None

class SearchRequest(BaseModel):
    query: str = ""
    filters: Optional[Filters] = None

class Internship(BaseModel):
    source: str
    title: str
    company: str
    location: str
    stipend: Optional[str]
    apply_url: Optional[str]
    description: Optional[str]
    tags: Optional[List[str]]
    score: Optional[float]
    is_new: Optional[bool]

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    model: Optional[str] = None

class UserLog(BaseModel):
    uid: str
    is_anonymous: bool = True
    email: Optional[str] = None
    platform: Optional[str] = None
    app_version: Optional[str] = None

_user_events: List[Dict] = []  # in-memory only; rotate/limit

@app.post("/api/log-user")
def log_user(evt: UserLog):
    # Keep max 500 recent
    _user_events.append({"t": datetime.now(timezone.utc).isoformat(), **evt.model_dump()})
    if len(_user_events) > 500:
        del _user_events[: len(_user_events) - 500]
    return {"ok": True, "count": len(_user_events)}

# Simple status endpoint for frontend to detect resume/session profile
@app.get("/api/resume-status")
def resume_status(request: Request):
    sid = _get_session_id(request)
    sess_text, sess_profile = _get_session_profile(sid)
    # Backward compat for old clients not sending session-id: expose legacy global in that case
    use_text = sess_text or ("" if sid else resume_text)
    use_profile = sess_profile if sess_text or sid else resume_profile
    return {
        "has_resume": bool(use_text),
        "skills": sorted(list(use_profile.get("skills", [])))[:12],
        "roles": sorted(list(use_profile.get("roles", [])))[:6],
        "location": use_profile.get("location"),
    }

@app.get("/api/diagnostics")
def diagnostics():
    """Lightweight internal snapshot (no secrets). Helps pre-deploy sanity checks.
    Avoid calling excessively (scraper sample hit)."""
    key_present = bool(os.getenv("OPENROUTER_API_KEY", "").strip())
    # Run one very small scrape (python internship India) with existing utility
    sample_jobs = []
    try:
        sample_jobs = fetch_internships("python internship", "India")[:3]
    except Exception:
        sample_jobs = []
    return {
        "health": "ok",
        "openrouter_configured": key_present,
        "linkedin_enabled": not DISABLE_LINKEDIN,
        "resume_loaded": bool(resume_text),
        "resume_skill_count": len(resume_profile.get("skills", [])),
        "resume_role_count": len(resume_profile.get("roles", [])),
        "user_log_events": len(_user_events),
        "sample_scrape_jobs": len(sample_jobs),
        "sample_scrape_titles": [j.get("title") for j in sample_jobs],
        "fallback_hint": "If sample_scrape_jobs is 0 repeatedly, scraping may be blocked/network-offline.",
        "ai_hint": "Chat will augment replies only when openrouter_configured is true.",
    }

# -----------------------------
# Search Endpoint
# -----------------------------
@app.post("/api/search", response_model=List[Internship])
def search_internships(req: SearchRequest, request: Request):
    global resume_text, resume_profile
    sid = _get_session_id(request)
    sess_text, sess_profile = _get_session_profile(sid)
    active_text = sess_text or ("" if sid else resume_text)
    active_profile = sess_profile if sess_text or sid else resume_profile
    # Offline mode short-circuit: return sample data without any network calls
    if os.getenv("OFFLINE_MODE", "0").lower() in {"1", "true", "yes", "on"}:
        user_q = (req.query or "").strip()
        location = (req.filters.location if req.filters else None) or resume_profile.get("location") or "India"  # type: ignore
        # Build a few representative queries for sample listings
        queries = []
        if user_q:
            queries.append(user_q)
        if resume_profile.get("roles"):
            for role in list(resume_profile["roles"])[:2]:
                queries.append(f"{role} internship")
        if resume_profile.get("skills"):
            queries.append(" ".join(list(resume_profile["skills"])[:3]) + " internship")
        if not queries:
            queries = ["software internship", "backend internship", "frontend internship"]

        sample = []
        for i, term in enumerate(queries[:3]):
            sample.append({
                "source": "sample",
                "title": f"{term.title()} (Offline Sample)",
                "company": "CompanyX",
                "location": location,
                "stipend": None,
                "apply_url": f"https://example.com/apply/{i}",
                "description": f"Offline mode enabled. Placeholder listing for '{term}'.",
                "tags": ["sample", "offline-mode"],
                "posted": "today",
            })
        # Score and return as Internship models
        out_jobs = []
        for job in sample:
            s = _score_job(job, resume_profile)
            job["score"] = s
            job["is_new"] = _tag_new(job.get("posted"))
            out_jobs.append(job)
        return [
            Internship(
                source=j.get("source", ""),
                title=j.get("title", ""),
                company=j.get("company", ""),
                location=j.get("location", ""),
                stipend=j.get("stipend"),
                apply_url=j.get("apply_url"),
                description=j.get("description"),
                tags=j.get("tags", []),
                score=j.get("score"),
                is_new=j.get("is_new"),
            )
            for j in out_jobs
        ]
    # Backward compatibility: allow legacy body with top-level 'location' key
    body_extra_location = None
    try:
        from fastapi import Request as _FReq  # type: ignore
    except Exception:
        _FReq = None  # type: ignore
    user_q = (req.query or "").strip()
    loc_fallback = "India"
    loc_from_filters = req.filters.location if req.filters else None  # type: ignore
    location = loc_from_filters or active_profile.get("location") or loc_fallback

    # Blended queries: user + resume + buzzword roles + fallback + tech-enhanced queries
    queries = set()
    if user_q:
        queries.add(user_q)
        # Add tech-enhanced version of user query
        tech_enhanced = _enhance_user_query_for_tech(user_q)
        if tech_enhanced != user_q:
            queries.add(tech_enhanced)
    
    if active_profile["roles"]:
        for role in list(active_profile["roles"])[:2]:
            queries.add(f"{role} internship")
    if active_profile["skills"]:
        # Create skill-based queries with tech focus
        top_skills = list(active_profile["skills"])[:3]
        skill_query = " ".join(top_skills) + " internship"
        queries.add(skill_query)
        # Add individual high-value skill queries
        high_value_skills = ["python", "java", "javascript", "react", "machine learning", "data science"]
        for skill in active_profile["skills"]:
            if skill.lower() in high_value_skills:
                queries.add(f"{skill} developer internship")
    
    # Add buzzword role queries (limit to most relevant)
    tech_focused_roles = ["software engineer", "web developer", "data scientist", "mobile developer"]
    for role in list(buzzword_roles)[:3]:  # reduced from 5 to focus on quality
        if any(tech_role in role for tech_role in tech_focused_roles):
            queries.add(f"{role} internship")
    
    # Add default tech queries if no specific tech skills found
    if not any(skill in str(active_profile.get("skills", [])).lower() 
              for skill in ["python", "java", "javascript", "react", "data"]):
        queries.add("software engineer internship")
        queries.add("web developer internship")
    
    queries.add("internship")  # fallback

    # Run scrapers in parallel with a short time budget for responsiveness
    all_jobs = []
    debug_scrapers = os.getenv("DEBUG_SCRAPERS", "0") in {"1","true","yes"}
    if debug_scrapers:
        print(f"[scrape] starting queries={len(queries)} -> {list(queries)[:6]}")
    # Keep responsiveness but allow tuning for more coverage via env vars
    # SEARCH_MAX_QUERIES: how many distinct query variants to dispatch (default 10)
    # SEARCH_TIME_BUDGET: overall seconds to wait for results (default 14.0)
    max_queries = int(os.getenv("SEARCH_MAX_QUERIES", "10"))
    time_budget_s = float(os.getenv("SEARCH_TIME_BUDGET", "14.0"))
    import time
    start_time = time.time()
    limited = list(queries)[:max_queries]
    per_query_limit = int(os.getenv("SEARCH_PER_QUERY_LIMIT", "20"))
    # Scale concurrency based on number of queries to cover more ground when needed
    max_workers = max(6, min(12, len(limited) * 2))
    executor = ThreadPoolExecutor(max_workers=max_workers)
    try:
        futures = []
        for idx, q in enumerate(limited):
            futures.append(executor.submit(fetch_internships, q, location, per_query_limit))
            # Run LinkedIn for the first 3 queries (configurable via DISABLE_LINKEDIN)
            if not DISABLE_LINKEDIN and idx < 3:
                try:
                    linkedin_fetch = _maybe_import_linkedin()
                    futures.append(executor.submit(linkedin_fetch, q, location))
                except Exception:
                    pass
        # Also kick off curated company careers scrapes informed by resume roles/skills/location
        if scrape_company_careers:
            try:
                selected_sites = _select_curated_careers(active_profile, location, max_sites=4)
            except Exception:
                selected_sites = _CURATED_CAREERS[:4]
            for cu in selected_sites:
                futures.append(executor.submit(scrape_company_careers, cu, 25))
        # Wait up to the time budget for any results
        done, pending = wait(futures, timeout=time_budget_s)
        for f in done:
            try:
                jobs = f.result()
                if jobs:
                    all_jobs.extend(jobs)
                    if debug_scrapers:
                        print(f"[scrape] got {len(jobs)} jobs (total {len(all_jobs)})")
                if len(all_jobs) >= 60:
                    break
            except Exception:
                if debug_scrapers:
                    import traceback
                    print("[scrape] worker failed:\n", traceback.format_exc())
                continue
        # Try to cancel any still-pending tasks and shutdown quickly
        for f in pending:
            try:
                f.cancel()
            except Exception:
                pass
    finally:
        # Do not wait for background scrapers; return immediately with partials
        try:
            executor.shutdown(wait=False, cancel_futures=True)
        except TypeError:
            # Python <3.9 fallback
            executor.shutdown(wait=False)

    if not all_jobs and os.getenv("ALLOW_SAMPLE_FALLBACK", "1") in {"1","true","yes","on"}:
        # Fallback: return synthetic sample results so UI still functions
        if debug_scrapers:
            print("[scrape] no real jobs fetched, returning fallback samples")
        sample = []
        base_terms = list(queries)[:3] or ["internship"]
        for i, term in enumerate(base_terms):
            sample.append({
                "source": "sample",
                "title": f"{term.title()} Internship (Sample)",
                "company": "CompanyX",
                "location": location,
                "stipend": None,
                "apply_url": f"https://example.com/apply/{i}",
                "description": f"Placeholder listing for '{term}'. Real scraping returned no results (likely blocked or offline).",
                "tags": ["sample", "offline-mode"],
                "posted": "today",
            })
        all_jobs = sample

    # Deduplicate
    all_jobs = _dedupe(all_jobs)

    # Score
    for job in all_jobs:
        s = _score_job(job, active_profile)
        job["score"] = s
        if s >= 85:
            job.setdefault("tags", []).append("🔥 hot")
        job["is_new"] = _tag_new(job.get("posted"))

    # Group by source
    from collections import defaultdict
    by_source = defaultdict(list)
    for job in all_jobs:
        by_source[job.get("source", "other").lower()].append(job)

    # Normalize scores per source
    for src, jobs in by_source.items():
        if not jobs:
            continue
        max_s = max(j["score"] for j in jobs) or 1
        for j in jobs:
            j["score"] = round((j["score"] / max_s) * 100, 2)

    # Sort inside each source
    for src in by_source:
        by_source[src].sort(key=lambda x: x["score"], reverse=True)

    # Balanced interleave: at least 40% from each if available. Cap total with env.
    final_cap = int(os.getenv("SEARCH_MAX_RESULTS", "80"))
    final_jobs = []
    src_names = list(by_source.keys())
    while any(by_source.values()) and len(final_jobs) < final_cap:
        for src in src_names:
            if by_source[src]:
                final_jobs.append(by_source[src].pop(0))

    # Limit duplicate roles in top results (gentle)
    dup_threshold = int(os.getenv("DUPLICATE_ROLE_LIMIT_N", "30"))
    seen_roles = set()
    diverse_jobs = []
    for job in final_jobs:
        role_key = job["title"].split()[0].lower()
        if role_key in seen_roles and len(diverse_jobs) < dup_threshold:
            continue
        seen_roles.add(role_key)
        diverse_jobs.append(job)

    return [
        Internship(
            source=job.get("source",""),
            title=job.get("title",""),
            company=job.get("company",""),
            location=job.get("location",""),
            stipend=job.get("stipend"),
            apply_url=job.get("apply_url"),
            description=job.get("description"),
            tags=job.get("tags", []),
            score=job.get("score"),
            is_new=job.get("is_new"),
        )
        for job in diverse_jobs
    ]

# -----------------------------
# Chat Endpoint (resume-aware and fun)
# -----------------------------
@app.post("/api/chat")
def chat_with_ai(req: ChatRequest, request: Request):
    global resume_text, resume_profile
    try:
        msg = (req.message or "").strip()
        # Derive effective session id: body field takes precedence, else header
        sid = req.session_id or _get_session_id(request)
        sess_text, sess_profile = _get_session_profile(sid)
        active_text = sess_text or ("" if sid else resume_text)
        active_profile = sess_profile if sess_text or sid else resume_profile

        if not msg:
            return {"response": "Please ask a question, e.g., ‘Rate my resume’."}

        # If OpenRouter is configured and not in OFFLINE_MODE, always return ONLY the AI's reply
        ai_enabled = (os.getenv("OFFLINE_MODE", "0").lower() not in {"1","true","yes","on"}) and bool(_openrouter_config()[0])
        if ai_enabled:
            # Use request headers as referer hint if present (helps OpenRouter attribution)
            referer = request.headers.get("origin") or request.headers.get("referer") or None
            ai_reply = _ai_enhanced_response(
                msg,
                active_text,
                active_profile,
                preferred_model=req.model,
                referer_override=referer,
                site_name_override=os.getenv("OPENROUTER_SITE_NAME", None),
            )
            if ai_reply:
                return {"response": ai_reply}
            hint = f" (diag: {_LAST_AI_ERROR})" if os.getenv("AI_DEBUG", "0") in {"1","true","yes"} and _LAST_AI_ERROR else ""
            return {"response": f"I’m having trouble reaching the AI right now. Please try again in a moment.{hint}"}

        # Fallback (no AI configured): keep responses minimal, no boilerplate.
        # Provide a tiny hint only; avoid long hardcoded content.
        return {"response": "AI is not configured on the server. Add OPENROUTER_API_KEY to enable smart answers."}
    except Exception as e:
        if os.getenv("DEBUG_LOG", "0") in {"1","true","yes"}:
            import traceback, logging
            logging.basicConfig(level=logging.INFO)
            logging.error("/api/chat crashed: %s", e)
            logging.error("Trace: %s", traceback.format_exc())
        # Never surface a 500 to the browser for chat; respond with a safe message
        return {"response": "I hit a snag processing that. Please try again."}

@app.get("/api/chat")
def chat_get_hint():
    # Helpful response for direct GETs in browser (avoid 405)
    return {"ok": True, "endpoint": "/api/chat", "hint": "Send a POST with JSON: { message, session_id? }"}

@app.options("/api/chat")
def chat_options():
    # Allow preflight without 405; CORS middleware will add necessary headers
    return Response(status_code=204)

# -----------------------------
# Resume Upload Endpoint
# -----------------------------
@app.post("/api/upload-resume")
async def upload_resume(request: Request, file: UploadFile = File(...)):
    global resume_text, resume_profile
    sid = _get_session_id(request)
    content = await file.read()
    text = ""
    fname = file.filename.lower()

    if fname.endswith(".pdf"):
        if not _PDF_ENABLED:
            return {"error": "PDF parsing requires PyMuPDF (install with: pip install PyMuPDF)."}
        try:
            with fitz.open(stream=content, filetype="pdf") as doc:  # type: ignore
                for page in doc:
                    text += page.get_text()
        except Exception as e:
            return {"error": f"Failed to parse PDF: {e}"}
    elif fname.endswith(".docx"):
        if not _DOCX_ENABLED:
            return {"error": "DOCX parsing requires python-docx (install with: pip install python-docx)."}
        try:
            document = docx.Document(io.BytesIO(content))  # type: ignore
            text = "\n".join(p.text for p in document.paragraphs)
        except Exception as e:
            return {"error": f"Failed to parse DOCX: {e}"}
    elif any(fname.endswith(ext) for ext in (".txt", ".md")):
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception as e:
            return {"error": f"Failed to read text file: {e}"}
    else:
        # Generic attempt: treat as text
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            return {"error": "Unsupported file type. Please upload PDF, DOCX or TXT."}

    # Basic cleanup
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return {"error": "No readable text extracted from resume."}

    resume_text = text  # legacy global for backward-compat

    # Extract profile info
    extracted_skills = set(_extract_keywords(text, max_terms=32))

    # Simple extra skill harvesting (common tech tokens)
    tech_tokens = re.findall(r"\b([A-Za-z][A-Za-z0-9+#\.]{1,20})\b", text.lower())
    tech_whitelist = {
        "python","java","javascript","typescript","react","node","django","fastapi","sql","mysql","postgresql","mongodb","docker","kubernetes","aws","azure","gcp","pandas","numpy","scikit-learn","tensorflow","pytorch","html","css","tailwind","git","linux","excel","powerbi","power","bi","mlflow","keras","flask","redis","next.js","next","jira","c++","c","go"}
    for t in tech_tokens:
        if t in tech_whitelist and len(extracted_skills) < 64:
            extracted_skills.add(t)

    extracted_roles = _extract_roles(text)
    loc = _extract_location(text)

    # Update legacy global profile (for old clients)
    resume_profile["skills"] = set(extracted_skills)
    resume_profile["roles"] = set(extracted_roles) or resume_profile.get("roles", set())
    if loc:
        resume_profile["location"] = loc

    # Write to session-scoped store as the source of truth for multi-user safety
    if sid:
        _sessions[sid] = {
            "resume_text": text,
            "resume_profile": {
                "skills": set(extracted_skills),
                "roles": set(extracted_roles) or set(),
                "location": loc or None,
            },
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    return {
        "success": True,
        "filename": file.filename,
    "skills_count": len(extracted_skills),
    "roles": sorted(list(extracted_roles))[:10],
    "location": loc,
    "sample_text": text[:400]
    }

# -----------------------------
# System Check Endpoint (deeper diagnostics for internal use)
# -----------------------------
@app.get("/api/system-check")
def system_check():
    """Run lightweight in-process assertions to confirm subsystems.

    Returns:
      health: always 'ok' if endpoint executes
      components: dict with status booleans
      notes: guidance for any failing component
    """
    notes = []
    # Scraper sample
    scraper_ok = False
    sample_titles = []
    try:
        sample = fetch_internships("python internship", "India")
        scraper_ok = len(sample) > 0
        sample_titles = [j.get("title") for j in sample[:3]]
        if not scraper_ok:
            notes.append("Internshala returned 0 items; may be blocked or network offline. UI will fall back to samples.")
    except Exception as e:
        notes.append(f"Internshala scraper error: {e}")

    # LinkedIn optional
    linkedin_ok = False
    if not DISABLE_LINKEDIN:
        try:
            lk_fn = _maybe_import_linkedin()
            lk_sample = lk_fn("python internship", "India")
            linkedin_ok = len(lk_sample) >= 0  # even empty is 'reachable'
        except Exception as e:
            notes.append(f"LinkedIn scraper import/run failed: {e}")
    else:
        notes.append("LinkedIn scraper disabled (DISABLE_LINKEDIN=1). This is expected if Selenium/Chromium not available.")

    # AI readiness
    key_present = bool(os.getenv("OPENROUTER_API_KEY", "").strip())
    ai_sample = None
    if key_present:
        ai_sample = _ai_enhanced_response("Return one word: pong", resume_text[:2000], resume_profile)
        if not ai_sample:
            notes.append("OpenRouter key set but model returned empty response (possible network issue or rate limit).")
    else:
        notes.append("No OPENROUTER_API_KEY set; chat will operate in heuristic-only mode.")

    # Resume state
    resume_ok = bool(resume_text)
    if not resume_ok:
        notes.append("No resume uploaded yet; some chat features limited.")

    return {
        "health": "ok",
        "components": {
            "scraper_internshala": scraper_ok,
            "scraper_linkedin_enabled": not DISABLE_LINKEDIN,
            "scraper_linkedin_reachable": linkedin_ok if not DISABLE_LINKEDIN else None,
            "ai_configured": key_present,
            "resume_loaded": resume_ok,
            "user_events_cached": len(_user_events),
        },
        "sample": {
            "internshala_titles": sample_titles,
            "ai_reply_excerpt": (ai_sample[:150] if ai_sample else None),
            "skills_count": len(resume_profile.get("skills", [])),
            "roles_count": len(resume_profile.get("roles", [])),
        },
        "notes": notes,
    }

if __name__ == "__main__":
    import uvicorn  # type: ignore
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    # Run with reload if explicitly requested
    reload = os.getenv("RELOAD", "0").lower() in {"1", "true", "yes"}
    uvicorn.run(app, host=host, port=port, reload=reload)
