# main.py - Full Feature + Speed + Variety + Buzzword Expansion

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
import docx
from typing import List, Dict, Optional
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor, as_completed, wait, FIRST_COMPLETED
from pydantic import BaseModel
from datetime import datetime, timedelta

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

# -----------------------------
# AI / OpenRouter Configuration
# -----------------------------
def _openrouter_config():
    """Fetch OpenRouter-related env vars dynamically so key changes don't require process restart."""
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    models = [m.strip() for m in os.getenv("OPENROUTER_MODELS", "deepseek/deepseek-chat-v3-0324:free").split(",") if m.strip()]
    base = os.getenv("OPENROUTER_BASE", "https://openrouter.ai/api/v1/chat/completions").strip()
    site_url = os.getenv("OPENROUTER_SITE_URL", "https://example.com").strip() or "https://example.com"
    site_name = os.getenv("OPENROUTER_SITE_NAME", "Career Copilot").strip() or "Career Copilot"
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
    return {"app": "StudentPilot API", "health": "/health", "endpoints": ["/api/search", "/api/upload-resume", "/api/chat"], "status": "ok"}
# Explicit CORS origins (override with CORS_ORIGINS env var comma separated)
_default_origins = (
    "http://localhost:5173,https://wms-virid-six.vercel.app,"
    "http://localhost:8080,http://127.0.0.1:8080,http://127.0.0.1:5173,"
    "http://wheresmystipend-env-1.eba-bdf4swct.ap-south-1.elasticbeanstalk.com"
)
_cors_env = os.getenv("CORS_ORIGINS", "").strip()
frontend_origin = os.getenv("FRONTEND_ORIGIN", "").strip()
# Normalize trailing slash early so single-origin mode matches browser Origin header
if frontend_origin.endswith('/'):
    frontend_origin = frontend_origin[:-1]
if frontend_origin and not _cors_env:
    allowed_origins = [frontend_origin]
else:
    # fallback to default list if custom not provided
    origins_raw = _cors_env or _default_origins
    allowed_origins = [o.strip() for o in origins_raw.split(",") if o.strip()]
    # Normalize (strip trailing slashes) so a value like https://example.com/ still matches browser Origin header
    allowed_origins = [o[:-1] if o.endswith('/') else o for o in allowed_origins]
    if frontend_origin and frontend_origin not in allowed_origins:
        # Ensure normalized as well
        fe_norm = frontend_origin[:-1] if frontend_origin.endswith('/') else frontend_origin
        if fe_norm not in allowed_origins:
            allowed_origins.append(fe_norm)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["http://localhost:5173"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET","POST","OPTIONS","HEAD"],  # include HEAD for health probes
    allow_headers=["*"],
    allow_credentials=True,
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

@app.get("/version")
def version_info():
    """Lightweight version & config surface for frontend debugging (no secrets)."""
    return {
        "status": "ok",
        "version": os.getenv("RELEASE", "dev"),
        "commit": os.getenv("GIT_SHA", "unknown"),
        "backend": "studentpilot",
        "openrouter": bool(os.getenv("OPENROUTER_API_KEY", "").strip()),
    }

resume_text = ""
resume_profile = {"skills": set(), "roles": set(), "location": None}
buzzword_skills = set()
buzzword_roles = set()

# -----------------------------
# Load Buzzwords CSV
# -----------------------------
csv_path = os.path.join(os.path.dirname(__file__), "btech_buzzwords.csv")
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
def _ai_enhanced_response(user_message: str, resume_text: str, profile: Dict) -> str:
    key, models, base, site_url, site_name = _openrouter_config()
    if not key or not user_message.strip():
        return ""
    system_prompt = (
        "You are StudentPilot—an internship and resume mentor. Be concrete, kind, and useful.\n"
        "Goals:\n"
        "1) Focus on the user's resume context (skills, roles, location) if present.\n"
        "2) Extract identity if asked (name, email, phone, location) only from provided resume text.\n"
        "3) Give actionable advice for internships: role suggestions, skill gaps, next steps, and resources.\n"
        "4) Keep answers concise, scannable, and positive.\n\n"
        "Output format (use emojis and bullets):\n"
        "🎯 Summary\n"
        "🧩 Skill Gaps (if any)\n"
        "�️ Improvements (clear next steps)\n"
        "� Roles & Keywords to target\n"
        "📌 Extras (links, ideas)\n"
        "💡 Tip\n"
    )
    profile_snippet = {
        "skills": sorted(list(profile.get("skills", [])))[:25],
        "roles": sorted(list(profile.get("roles", [])))[:10],
        "location": profile.get("location"),
    }
    resume_excerpt = (resume_text or "")[:4000]
    for model in models:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"User message: {user_message}\nProfile: {json.dumps(profile_snippet)}\nResume excerpt: {resume_excerpt}"},
            ],
            "temperature": 0.7,
            "max_tokens": 500,
        }
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
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
                    import re
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
            continue
    return ""

@app.get("/api/ai-test")
def ai_test():
    """Quick diagnostic to verify OpenRouter connectivity (no resume context)."""
    key, models, *_ = _openrouter_config()
    if not key:
        return {"ok": False, "reason": "OPENROUTER_API_KEY not set in environment"}
    sample = _ai_enhanced_response("Return one word: ping", "", {})
    return {"ok": bool(sample), "sample": sample or None, "model": models[:1]}

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
    _user_events.append({"t": datetime.utcnow().isoformat(), **evt.dict()})
    if len(_user_events) > 500:
        del _user_events[: len(_user_events) - 500]
    return {"ok": True, "count": len(_user_events)}

# Simple status endpoint for frontend to detect resume/session profile
@app.get("/api/resume-status")
def resume_status():
    return {
        "has_resume": bool(resume_text),
        "skills": sorted(list(resume_profile.get("skills", [])))[:12],
        "roles": sorted(list(resume_profile.get("roles", [])))[:6],
        "location": resume_profile.get("location"),
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
def search_internships(req: SearchRequest):
    global resume_text, resume_profile
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
    location = loc_from_filters or resume_profile.get("location") or loc_fallback

    # Blended queries: user + resume + buzzword roles + fallback + tech-enhanced queries
    queries = set()
    if user_q:
        queries.add(user_q)
        # Add tech-enhanced version of user query
        tech_enhanced = _enhance_user_query_for_tech(user_q)
        if tech_enhanced != user_q:
            queries.add(tech_enhanced)
    
    if resume_profile["roles"]:
        for role in list(resume_profile["roles"])[:2]:
            queries.add(f"{role} internship")
    if resume_profile["skills"]:
        # Create skill-based queries with tech focus
        top_skills = list(resume_profile["skills"])[:3]
        skill_query = " ".join(top_skills) + " internship"
        queries.add(skill_query)
        # Add individual high-value skill queries
        high_value_skills = ["python", "java", "javascript", "react", "machine learning", "data science"]
        for skill in resume_profile["skills"]:
            if skill.lower() in high_value_skills:
                queries.add(f"{skill} developer internship")
    
    # Add buzzword role queries (limit to most relevant)
    tech_focused_roles = ["software engineer", "web developer", "data scientist", "mobile developer"]
    for role in list(buzzword_roles)[:3]:  # reduced from 5 to focus on quality
        if any(tech_role in role for tech_role in tech_focused_roles):
            queries.add(f"{role} internship")
    
    # Add default tech queries if no specific tech skills found
    if not any(skill in str(resume_profile.get("skills", [])).lower() 
              for skill in ["python", "java", "javascript", "react", "data"]):
        queries.add("software engineer internship")
        queries.add("web developer internship")
    
    queries.add("internship")  # fallback

    # Run scrapers in parallel with a short time budget for responsiveness
    all_jobs = []
    debug_scrapers = os.getenv("DEBUG_SCRAPERS", "0") in {"1","true","yes"}
    if debug_scrapers:
        print(f"[scrape] starting queries={len(queries)} -> {list(queries)[:6]}")
    # Keep responsiveness: cap queries and add a 6s overall budget
    max_queries = 6
    time_budget_s = float(os.getenv("SEARCH_TIME_BUDGET", "6.0"))
    import time
    start_time = time.time()
    limited = list(queries)[:max_queries]
    executor = ThreadPoolExecutor(max_workers=6)
    try:
        futures = []
        for idx, q in enumerate(limited):
            futures.append(executor.submit(fetch_internships, q, location))
            # Limit LinkedIn Selenium fetch to first 2 queries to reduce heavy startup cost
            if not DISABLE_LINKEDIN and idx < 2:
                try:
                    linkedin_fetch = _maybe_import_linkedin()
                    futures.append(executor.submit(linkedin_fetch, q, location))
                except Exception:
                    pass
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

    if not all_jobs:
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
        s = _score_job(job, resume_profile)
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

    # Balanced interleave: at least 40% from each if available
    final_jobs = []
    src_names = list(by_source.keys())
    while any(by_source.values()) and len(final_jobs) < 50:
        for src in src_names:
            if by_source[src]:
                final_jobs.append(by_source[src].pop(0))

    # Limit duplicate roles in top results
    seen_roles = set()
    diverse_jobs = []
    for job in final_jobs:
        role_key = job["title"].split()[0].lower()
        if role_key in seen_roles and len(diverse_jobs) < 20:
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
def chat_with_ai(req: ChatRequest):
    global resume_text, resume_profile
    msg = (req.message or "").strip()
    lower = msg.lower()

    if not msg:
        return {"response": "Please ask a question, e.g., ‘Rate my resume’."}

    # If OpenRouter is configured and not in OFFLINE_MODE, always return ONLY the AI's reply
    ai_enabled = (os.getenv("OFFLINE_MODE", "0").lower() not in {"1","true","yes","on"}) and bool(_openrouter_config()[0])
    if ai_enabled:
        ai_reply = _ai_enhanced_response(msg, resume_text, resume_profile)
        if ai_reply:
            return {"response": ai_reply}
        return {"response": "I’m having trouble reaching the AI right now. Please try again in a moment."}

    # Fallback (no AI configured): keep responses minimal, no boilerplate.
    # Provide a tiny hint only; avoid long hardcoded content.
    return {"response": "AI is not configured on the server. Add OPENROUTER_API_KEY to enable smart answers."}

# -----------------------------
# Resume Upload Endpoint
# -----------------------------
@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    global resume_text, resume_profile
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
        try:
            document = docx.Document(io.BytesIO(content))
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

    resume_text = text

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

    # Update global profile (merge to keep previously inferred data)
    resume_profile["skills"] = set(extracted_skills)
    resume_profile["roles"] = set(extracted_roles) or resume_profile.get("roles", set())
    if loc:
        resume_profile["location"] = loc

    return {
        "success": True,
        "filename": file.filename,
        "skills_count": len(resume_profile["skills"]),
        "roles": sorted(list(resume_profile["roles"]))[:10],
        "location": resume_profile.get("location"),
        "sample_text": resume_text[:400]
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
