# main.py - Full-featured merged version
"""
Full-featured backend:
- Resume upload (PDF/DOCX/TXT) -> extract skills/roles/location
- /api/search: blended queries (user + resume + fallback), parallel scrapes (Internshala + LinkedIn),
  dedupe, semantic or keyword ranking, score/is_new flags, source variety guarantees.
- /api/chat: OpenRouter + Gemini fallback with rate-limit handling and resume context
- Optional Firebase auth (if firebase-admin + credentials present)
- Loads btech_buzzwords.csv to boost keyword extraction
"""
import os
import io
import csv
import time
import re
import logging
from typing import List, Dict, Optional, Any, Tuple
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import FastAPI, File, UploadFile, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Optional heavy deps
try:
    import fitz  # PyMuPDF
    FITZ_AVAILABLE = True
except Exception:
    fitz = None
    FITZ_AVAILABLE = False

try:
    import docx
    DOCX_AVAILABLE = True
except Exception:
    docx = None
    DOCX_AVAILABLE = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False

try:
    from rapidfuzz import fuzz
    RAPIDFUZZ_AVAILABLE = True
except Exception:
    RAPIDFUZZ_AVAILABLE = False

# AI + 3rd party libs (optional)
try:
    import google.generativeai as genai
except Exception:
    genai = None

import requests

# Firebase optional
AUTH_ENABLED = False
auth = None
try:
    import firebase_admin
    from firebase_admin import credentials, auth as fb_auth
    if os.path.exists("firebase-adminsdk.json"):
        cred = credentials.Certificate("firebase-adminsdk.json")
        firebase_admin.initialize_app(cred)
        auth = fb_auth
        AUTH_ENABLED = True
except Exception as e:
    logging.warning(f"Firebase not enabled or missing creds: {e}")

# dotenv
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# Scraper imports (keep them as in your project)
from scrapers.internshala import fetch_internships
try:
    from scrapers.linkedin import fetch_linkedin_internships
    ENABLE_LINKEDIN_IMPORT = True
except Exception as e:
    logging.warning(f"LinkedIn import failed: {e}")
    ENABLE_LINKEDIN_IMPORT = False
    def fetch_linkedin_internships(query: str, location: Optional[str] = None, limit: int = 12):
        return []

# Environment & feature toggles
ENABLE_LINKEDIN = os.getenv("ENABLE_LINKEDIN", "true").lower() == "true" and ENABLE_LINKEDIN_IMPORT
REQUIRE_AUTH = os.getenv("REQUIRE_AUTH", "false").lower() == "true"

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE = os.getenv("OPENROUTER_BASE", "https://openrouter.ai/api/v1/chat/completions")
OPENROUTER_MODELS = [m.strip() for m in os.getenv("OPENROUTER_MODELS", "qwen/qwen3-coder:free").split(",") if m.strip()]
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if GOOGLE_API_KEY and genai is not None:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
    except Exception:
        pass

# Logging
logging.basicConfig(level=logging.INFO)

# FastAPI app
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# In-memory state
resume_text_store = ""
resume_profile: Dict[str, Any] = {"skills": set(), "roles": set(), "location": None}
buzzword_set: set[str] = set()

# load buzzwords CSV if present
csv_path = os.path.join(os.path.dirname(__file__), "data", "btech_buzzwords.csv")
if os.path.exists(csv_path):
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                skills = (row.get("Required_Skills") or "").split(",")
                for s in skills:
                    s_norm = s.strip().lower()
                    if s_norm:
                        buzzword_set.add(s_norm)
    except Exception as e:
        logging.warning(f"Error loading buzzwords CSV: {e}")

# Skill & role banks
_SKILL_BANK = [
    "python","java","c++","c#","javascript","typescript","go","rust","node","react","angular","vue",
    "django","flask","fastapi","machine learning","deep learning","nlp","pandas","numpy","tensorflow",
    "pytorch","sql","mysql","postgresql","mongodb","aws","azure","gcp","docker","kubernetes","git",
    "rest api","graphql","ci/cd","android","ios","flutter","react native","html","css","redis","kafka"
]
_ROLE_HINTS = [
    "software engineer","sde","backend","frontend","full stack","data analyst","data scientist",
    "ml engineer","devops","cloud engineer","android developer","ios developer","qa","testing",
    "product engineer","ai engineer","web developer"
]
_LOC_PATTERN = re.compile(r"\b(?:based in|location|currently in|city)\s*[:\-]?\s*([A-Za-z ,]+)", re.I)

# Utility functions
def _normalize(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "").strip())

def _extract_keywords(text: str, max_terms: int = 8) -> List[str]:
    if not text:
        return []
    text_l = text.lower()
    found: List[str] = []
    for s in _SKILL_BANK:
        if s in text_l and s not in found:
            found.append(s)
        if len(found) >= max_terms:
            break
    if len(found) < max_terms and buzzword_set:
        for bw in buzzword_set:
            if bw in text_l and bw not in found:
                found.append(bw)
            if len(found) >= max_terms:
                break
    if not found:
        tokens = [w.strip(",.;:\n\t ") for w in text_l.split() if len(w) > 3]
        seen = set()
        for t in tokens:
            if t not in seen:
                found.append(t)
                seen.add(t)
            if len(found) >= max_terms:
                break
    return found

def _extract_roles(text: str, max_roles: int = 4) -> List[str]:
    text_l = text.lower()
    roles = []
    for r in _ROLE_HINTS:
        if r in text_l:
            roles.append(r)
            if len(roles) >= max_roles:
                break
    m = re.findall(r"(?:seeking|objective)[:\-]?\s*([a-zA-Z ]+)", text_l)
    for cand in m:
        cand = cand.strip()
        if cand and cand not in roles:
            roles.append(cand)
    return roles[:max_roles]

def _extract_location(text: str) -> Optional[str]:
    m = _LOC_PATTERN.search(text or "")
    if m:
        loc = _normalize(m.group(1))
        if len(loc) < 64:
            return loc
    return None

def _build_resume_profile(text: str) -> Dict[str, Any]:
    skills = set(map(str.lower, _extract_keywords(text, 12)))
    roles = set(map(str.lower, _extract_roles(text, 6)))
    location = _extract_location(text)
    return {"skills": skills, "roles": roles, "location": location}

# Scoring utilities
def _soft_contains(hay: str, needle: str) -> bool:
    if not hay or not needle:
        return False
    if needle in hay:
        return True
    if RAPIDFUZZ_AVAILABLE:
        return fuzz.partial_ratio(hay, needle) >= 85
    return False

def _tag_from_description(desc: str) -> List[str]:
    tags = []
    d = (desc or "").lower()
    if any(w in d for w in ["remote", "work from home", "wfh"]):
        tags.append("remote")
    if any(w in d for w in ["hybrid"]):
        tags.append("hybrid")
    if any(w in d for w in ["on-site", "onsite", "on site"]):
        tags.append("onsite")
    if re.search(r"(₹|rs\.?|inr)\s*\d", d):
        tags.append("stipend")
    return tags

def _keyword_overlap_score(text: str, skills: set, roles: set) -> float:
    if not text:
        return 0.0
    t = text.lower()
    ks = sum(1 for s in skills if s in t)
    rs = sum(1 for r in roles if r in t)
    return min(1.0, 0.06 * ks + 0.12 * rs)

def _semantic_score(resume: str, job_text: str) -> float:
    if not SKLEARN_AVAILABLE or not resume or not job_text:
        return 0.0
    try:
        vect = TfidfVectorizer(stop_words="english", max_features=6000)
        X = vect.fit_transform([resume, job_text])
        sim = cosine_similarity(X[0:1], X[1:2])[0][0]
        return float(sim)
    except Exception:
        return 0.0

def _score_job(item: Dict[str, Any], profile: Dict[str, Any], resume_text: str) -> Tuple[float, List[str]]:
    text = " ".join([
        item.get("title") or "",
        item.get("company") or "",
        item.get("description") or ""
    ])
    tags_auto = _tag_from_description(text)
    kw_score = _keyword_overlap_score(text, profile["skills"], profile["roles"])
    sem_score = _semantic_score(resume_text, text)
    final = max(kw_score, sem_score)
    title_l = (item.get("title") or "").lower()
    if any(_soft_contains(title_l, r) for r in profile["roles"]):
        final = min(1.0, final + 0.12)
    return final, tags_auto

def _dedupe(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    unique: List[Dict[str, Any]] = []
    for it in items:
        key = (it.get("apply_url") or "").split("?")[0].strip().lower()
        if not key:
            key = (it.get("title","").lower(), it.get("company","").lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(it)
    return unique

def _is_recent(posted_text: Optional[str]) -> bool:
    if not posted_text:
        return False
    t = posted_text.lower()
    if "today" in t or "just now" in t:
        return True
    m = re.search(r"(\d+)\s+day", t)
    if m:
        try:
            return int(m.group(1)) <= 7
        except Exception:
            return False
    return False

# Pydantic models
class Filters(BaseModel):
    location: Optional[str] = None
    experience_level: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    filters: Filters

class Internship(BaseModel):
    source: str
    title: str
    company: str
    location: str
    stipend: Optional[str] = None
    apply_url: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    score: Optional[float] = None
    is_new: Optional[bool] = None

class ChatRequest(BaseModel):
    message: str

# Search implementation: blended queries + parallelism + variety guarantees
def _build_blended_queries(user_query: str, resume_text: str, profile: Dict[str, Any]) -> List[str]:
    queries: List[str] = []
    user_q = (user_query or "").strip()
    if user_q:
        queries.append(user_q)
    if resume_text:
        if profile.get("roles"):
            queries.append(f"{list(profile['roles'])[0]} internship")
        skills = list(profile.get("skills") or [])
        if skills:
            queries.append(" ".join(skills[:4]) + " internship")
        # some keyword fallback:
        kw = _extract_keywords(resume_text, 6)
        if kw:
            queries.append(" ".join(kw) + " internship")
    if not queries:
        queries.append("internship")
    # ensure uniqueness, preserve order
    seen = set()
    out = []
    for q in queries:
        if q and q not in seen:
            out.append(q)
            seen.add(q)
    return out[:4]  # limit to few queries to avoid overload

def _parallel_fetch_all(queries: List[str], location: Optional[str], per_query_limit: int = 8, max_workers: int = 6) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = []
        # Schedule fetches: both sources for each query
        for q in queries:
            futures.append(ex.submit(fetch_internships, q, location, per_query_limit))
            if ENABLE_LINKEDIN:
                futures.append(ex.submit(fetch_linkedin_internships, q, location, per_query_limit))
        for f in as_completed(futures):
            try:
                res = f.result()
                if res:
                    jobs.extend(res)
            except Exception as e:
                logging.warning(f"Scraper task failed: {e}")
    return jobs

@app.post("/api/search", response_model=List[Internship])
def search_internships(
    req: SearchRequest,
    top_n: int = Query(24, ge=1, le=200),
    min_score: float = Query(0.12, ge=0.0, le=1.0),
    use_resume: bool = Query(True),
):
    global resume_text_store, resume_profile

    user_query = (req.query or "").strip()
    location = (req.filters.location if req.filters else None) or resume_profile.get("location") or "India"

    queries = _build_blended_queries(user_query, resume_text_store, resume_profile)
    logging.info(f"Blended queries: {queries} | location={location}")

    # Parallel scrape
    all_scraped = _parallel_fetch_all(queries, location, per_query_limit=12, max_workers=6)

    # If source imbalance: ensure variety with fallback queries per-source
    # Guarantee at least 30% items from each active source (if available)
    def count_source(src: str, arr: List[Dict[str,Any]]) -> int:
        return sum(1 for a in arr if a.get("source","").lower() == src.lower())

    if all_scraped:
        # If Internshala is active but low, call a broad internshala query
        if count_source("internshala", all_scraped) < 1:
            try:
                all_scraped += fetch_internships("internship", location, limit=8)
            except Exception:
                pass
        if ENABLE_LINKEDIN and count_source("linkedin", all_scraped) < 1:
            try:
                all_scraped += fetch_linkedin_internships("internship", location, limit=8)
            except Exception:
                pass

    if not all_scraped:
        return []

    # Clean & normalize fields
    for it in all_scraped:
        it["title"] = _normalize(it.get("title", ""))
        it["company"] = _normalize(it.get("company", ""))
        it["location"] = _normalize(it.get("location", "") or location)
        it["description"] = _normalize(it.get("description", ""))[:1200]
        it["tags"] = list(set((it.get("tags") or []) + _tag_from_description(it.get("description",""))))

    # Dedupe
    all_scraped = _dedupe(all_scraped)

    # Score & filter
    if use_resume and resume_text_store:
        scored: List[Tuple[float, Dict[str, Any]]] = []
        for it in all_scraped:
            s, auto_tags = _score_job(it, resume_profile, resume_text_store)
            it["score"] = round(float(s), 4)
            it["tags"] = list(set(it.get("tags", []) + auto_tags))
            it["is_new"] = _is_recent(it.get("posted"))
            scored.append((s, it))
        # sort by score desc
        scored.sort(key=lambda x: x[0], reverse=True)
        filtered = [it for s, it in scored if s >= min_score]
    else:
        # heuristic sort without resume
        def _heur(it):
            t = (it.get("title","") + " " + it.get("description","")).lower()
            score = 0.0
            if any(k in t for k in ["intern", "internship"]): score += 0.18
            if any(k in t for k in ["python","react","node","java","sql"]): score += 0.08
            if "remote" in t: score += 0.05
            return score
        tmp = [( _heur(it), it ) for it in all_scraped]
        tmp.sort(key=lambda x: x[0], reverse=True)
        filtered = [it for _, it in tmp]

    # Guarantee some source variety in final top_n
    # We'll try to interleave by source while preserving sort order within each source
    def interleave_by_source(items: List[Dict[str,Any]], n: int, min_pct_per_source: float = 0.25) -> List[Dict[str,Any]]:
        if not items:
            return []
        # group
        groups: Dict[str, List[Dict[str,Any]]] = {}
        for it in items:
            src = (it.get("source") or "other").lower()
            groups.setdefault(src, []).append(it)
        # if only one source, just return top n
        if len(groups) <= 1:
            return items[:n]
        result = []
        # round-robin take one from each group until filled
        while len(result) < n:
            made_progress = False
            for src, arr in groups.items():
                if arr:
                    result.append(arr.pop(0))
                    made_progress = True
                    if len(result) >= n:
                        break
            if not made_progress:
                break
        return result[:n]

    top_items = interleave_by_source(filtered, top_n, min_pct_per_source=0.20)

    # Add UX tags: hot if score >= 0.85 (85%), convert score to 0..100 for frontend
    for it in top_items:
        sc = it.get("score")
        if sc is not None:
            it["score"] = round(float(sc) * 100, 2)
            if sc >= 0.85:
                it.setdefault("tags", []).append("🔥 hot")
        else:
            it["score"] = None
        it.setdefault("is_new", _is_recent(it.get("posted")))

    # Shape response
    out = []
    for it in top_items:
        out.append(
            Internship(
                source=it.get("source",""),
                title=it.get("title",""),
                company=it.get("company",""),
                location=it.get("location",""),
                stipend=it.get("stipend"),
                apply_url=it.get("apply_url"),
                description=it.get("description"),
                tags=it.get("tags", []),
                score=it.get("score"),
                is_new=it.get("is_new"),
            )
        )
    return out

# Resume upload with robust parsing
@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    global resume_text_store, resume_profile
    content = await file.read()
    text = ""
    fname = (file.filename or "").lower()

    try:
        if fname.endswith(".pdf"):
            if FITZ_AVAILABLE:
                with fitz.open(stream=content, filetype="pdf") as pdf_doc:
                    for page in pdf_doc:
                        text += page.get_text()
            else:
                return {"error": "PDF parsing requires PyMuPDF. Install PyMuPDF or upload DOCX/TXT."}
        elif fname.endswith(".docx"):
            if DOCX_AVAILABLE:
                d = docx.Document(io.BytesIO(content))
                for para in d.paragraphs:
                    text += para.text + "\n"
            else:
                return {"error": "DOCX parsing requires python-docx. Install python-docx or upload PDF/TXT."}
        elif fname.endswith(".txt"):
            text = content.decode("utf-8", errors="ignore")
        else:
            return {"error": "Unsupported file format. Use PDF, DOCX, or TXT."}
    except Exception as e:
        return {"error": f"Failed to parse resume: {e}"}

    resume_text_store = _normalize(text)
    resume_profile = _build_resume_profile(resume_text_store)

    return {
        "message": "Resume uploaded successfully",
        "chars": len(resume_text_store),
        "skills_detected": sorted(list(resume_profile["skills"]))[:15],
        "roles_detected": sorted(list(resume_profile["roles"]))[:6],
        "location_guess": resume_profile["location"],
    }

# Chat endpoint with OpenRouter & Gemini fallback, using resume context
@app.post("/api/chat")
def chat_with_ai(req: ChatRequest, id_token: Optional[str] = Header(default=None)):
    if REQUIRE_AUTH:
        if not (AUTH_ENABLED and id_token):
            raise HTTPException(status_code=401, detail="Authentication required")
        try:
            assert auth is not None
            auth.verify_id_token(id_token)
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid authentication credentials: {e}")
    else:
        if AUTH_ENABLED and id_token:
            try:
                assert auth is not None
                auth.verify_id_token(id_token)
            except Exception as e:
                logging.warning(f"Auth header provided but invalid: {e}")

    msg_l = (req.message or "").lower()
    intent = "general"
    if ("rate" in msg_l and "resume" in msg_l) or ("score" in msg_l and "resume" in msg_l):
        intent = "rate_resume"
    elif "skill gap" in msg_l or "skill-gap" in msg_l or "gap analysis" in msg_l:
        intent = "skill_gap"

    context = (
        "You are an expert AI career coach for students. Answer with clear bullet points and short sentences. "
        "Use the user's resume purely as context if provided. Prefer actionable advice.\n\n"
        "Output rules:\n"
        "- One-line summary then bullets.\n"
        "- Use short headers like SUMMARY, STRENGTHS, GAPS, NEXT STEPS.\n"
        "- Keep to 8-12 bullets unless asked for more.\n"
    )

    resume_snippet = (resume_text_store or "")[:4000]

    if intent == "rate_resume":
        task = (
            "RATE RESUME OUT OF 10. Consider clarity, impact, relevance, and keywords. "
            "Return: 'Score: X/10' then bullets for STRENGTHS, IMPROVEMENTS, NEXT STEPS."
        )
    elif intent == "skill_gap":
        task = (
            "SKILL GAP ANALYSIS from resume. Provide MATCHED SKILLS, MISSING SKILLS, LEARNING PLAN. "
            "Be specific. If resume missing, ask the user to upload it."
        )
    else:
        task = "Answer the user's question about internships, jobs, skills, or resume improvements. Prioritize actionable steps."

    # Try OpenRouter first (if key present)
    try:
        if OPENROUTER_API_KEY:
            messages = [{"role": "system", "content": context}]
            if resume_snippet:
                messages.append({"role": "system", "content": f"RESUME (optional):\n{resume_snippet}"})
            messages.append({"role": "system", "content": f"TASK: {task}"})
            messages.append({"role": "user", "content": req.message})

            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            }
            for model_name in OPENROUTER_MODELS:
                try:
                    r = requests.post(
                        OPENROUTER_BASE,
                        headers=headers,
                        json={
                            "model": model_name,
                            "messages": messages,
                            "temperature": 0.5,
                            "top_p": 0.9,
                            "max_tokens": 700,
                        },
                        timeout=60,
                    )
                    if r.status_code == 200:
                        data = r.json()
                        text = (data.get("choices", [{}])[0].get("message", {}).get("content", ""))
                        if text:
                            return {"response": text}
                    elif r.status_code == 429:
                        logging.warning("OpenRouter rate limited, trying next provider...")
                        continue
                    else:
                        logging.warning(f"OpenRouter returned {r.status_code}: {r.text}")
                except Exception as e:
                    logging.warning(f"OpenRouter call failed: {e}")
            # if OpenRouter fails, fall through to Gemini
        # Gemini fallback
        if genai is not None and GOOGLE_API_KEY:
            gen_config = {"temperature": 0.6, "top_p": 0.95, "top_k": 40, "max_output_tokens": 700}
            model_candidates = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
            prompt = f"{context}\n\nRESUME (optional):\n{resume_snippet}\n\nTASK: {task}\n\nUSER: {req.message}\nASSISTANT:"
            text = None
            last_err = None
            for m in model_candidates:
                try:
                    model = genai.GenerativeModel(m, generation_config=gen_config)
                    resp = model.generate_content(prompt)
                    text = getattr(resp, "text", None)
                    if not text:
                        cands = getattr(resp, "candidates", [])
                        if cands and getattr(cands[0], "content", None):
                            parts = getattr(cands[0].content, "parts", [])
                            text = "".join(getattr(p, "text", "") for p in parts)
                    if text:
                        return {"response": text}
                except Exception as e:
                    last_err = e
                    logging.warning(f"Gemini attempt for model {m} failed: {e}")
            if last_err:
                return {"response": f"AI error: {last_err}"}
        # If no provider worked
        return {"response": "Sorry, no AI provider available or it's temporarily rate-limited."}
    except Exception as e:
        logging.exception("AI error")
        return {"response": f"AI error: {str(e)}"}

# Dev server
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
