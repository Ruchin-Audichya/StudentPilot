import os
import io
import csv
from typing import List, Optional

from fastapi import FastAPI, File, UploadFile, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Optional imports with graceful fallbacks
try:
    import fitz  # PyMuPDF
    FITZ_AVAILABLE = True
except Exception:
    fitz = None  # type: ignore
    FITZ_AVAILABLE = False

try:
    import docx  # python-docx
    DOCX_AVAILABLE = True
except Exception:
    docx = None  # type: ignore
    DOCX_AVAILABLE = False

import logging
import re
import time
import google.generativeai as genai
import requests
from pathlib import Path

# Feature flags
ENABLE_LINKEDIN = os.getenv("ENABLE_LINKEDIN", "true").lower() == "true"
REQUIRE_AUTH = os.getenv("REQUIRE_AUTH", "false").lower() == "true"

# Firebase is optional; enable only if sdk file exists and package is available
AUTH_ENABLED = False
auth = None
try:
    import firebase_admin  # type: ignore
    from firebase_admin import credentials, auth as fb_auth  # type: ignore
    if os.path.exists("firebase-adminsdk.json"):
        cred = credentials.Certificate("firebase-adminsdk.json")
        firebase_admin.initialize_app(cred)
        auth = fb_auth
        AUTH_ENABLED = True
except Exception as e:
    logging.warning(f"Firebase not enabled: {e}")
    AUTH_ENABLED = False
    auth = None

from dotenv import load_dotenv

# Scrapers
from scrapers.internshala import fetch_internships
try:
    from scrapers.linkedin import fetch_linkedin_internships  # requires selenium/webdriver-manager
except Exception as e:
    logging.warning(f"LinkedIn scraper import failed: {e}")
    ENABLE_LINKEDIN = False
    def fetch_linkedin_internships(query: str, location: Optional[str] = None, limit: int = 12):  # type: ignore
        return []
# Load env from repo root and backend folder (so placing .env at the root works)
try:
    root_env = Path(__file__).resolve().parents[1] / ".env"
    backend_env = Path(__file__).resolve().parent / ".env"
    # Load root first, then backend (backend can override)
    load_dotenv(dotenv_path=root_env, override=False)
    load_dotenv(dotenv_path=backend_env, override=False)
except Exception:
    load_dotenv()
logging.basicConfig(level=logging.INFO)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "qwen/qwen3-coder:free")
OPENROUTER_BASE = os.getenv("OPENROUTER_BASE", "https://openrouter.ai/api/v1/chat/completions")
OPENROUTER_REF = os.getenv("OPENROUTER_SITE_URL")
OPENROUTER_TITLE = os.getenv("OPENROUTER_SITE_NAME")
OPENROUTER_MODELS = [m.strip() for m in os.getenv("OPENROUTER_MODELS", OPENROUTER_MODEL).split(",") if m.strip()]

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not OPENROUTER_API_KEY and not GOOGLE_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY or GOOGLE_API_KEY must be set in environment variables")

if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

app = FastAPI()


# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Store resume text temporarily
resume_text_store = ""
buzzword_set: set[str] = set()

# Load B.Tech buzzwords from CSV if present
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
    except Exception:
        pass

def extract_keywords(text: str, max_terms: int = 6) -> list[str]:
    """Very small heuristic keyword extractor for resumes.
    Scans for common tech skills and returns a top-limited list for search.
    """
    if not text:
        return []
    text_l = text.lower()
    skill_bank = [
        # Programming
        "python", "java", "c++", "c#", "javascript", "typescript", "go", "rust",
        "node", "react", "angular", "vue", "next.js", "django", "flask", "fastapi",
        # Data/AI
        "machine learning", "deep learning", "nlp", "cv", "pandas", "numpy", "tensorflow",
        "pytorch", "scikit-learn", "sql", "mysql", "postgresql", "mongodb", "data analysis",
        # Cloud/DevOps/Web
        "aws", "azure", "gcp", "docker", "kubernetes", "linux", "git", "rest api",
        # Mobile
        "android", "ios", "flutter", "react native",
        # Other
        "html", "css", "tailwind", "sass"
    ]
    found = []
    for s in skill_bank:
        if s in text_l and s not in found:
            found.append(s)
        if len(found) >= max_terms:
            break
    # Add CSV buzzwords if present
    if len(found) < max_terms and buzzword_set:
        for bw in buzzword_set:
            if bw in text_l and bw not in found:
                found.append(bw)
            if len(found) >= max_terms:
                break
    # If nothing matched, fallback to first 5 unique words > 3 chars
    if not found:
        tokens = [w.strip(",.;:\n\t ") for w in text_l.split() if len(w) > 3]
        uniq = []
        for t in tokens:
            if t not in uniq:
                uniq.append(t)
            if len(uniq) >= max_terms:
                break
        found = uniq
    return found

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

class ChatRequest(BaseModel):
    message: str

@app.post("/api/search", response_model=List[Internship])
def search_internships(req: SearchRequest):
    location = (req.filters.location if req.filters else None) or "India"
    q = (req.query or "").strip()

    # First attempt: user query
    internshala_results = []
    linkedin_results = []
    try:
        internshala_results = fetch_internships(q or "intern", location=location)
    except Exception as e:
        logging.warning(f"Internshala scraper error: {e}")
    if ENABLE_LINKEDIN:
        try:
            linkedin_results = fetch_linkedin_internships(q or "intern", location=location)
        except Exception as e:
            logging.warning(f"LinkedIn scraper error: {e}")

    # Combine results
    scraped = internshala_results + linkedin_results

    # Fallback: use resume keywords if no results or query empty
    if not scraped:
        kw = extract_keywords(resume_text_store)
        if kw:
            internshala_results = fetch_internships(" ".join(kw[:5]), location=location)
            linkedin_results = fetch_linkedin_internships(" ".join(kw[:5]), location=location)
            scraped = internshala_results + linkedin_results

    if scraped:
        return [
            Internship(
                source=i['source'],
                title=i['title'],
                company=i['company'],
                location=i['location'],
                stipend=i.get('stipend'),
                apply_url=i['apply_url'],
                description=i['description'],
                tags=i.get('tags', [])
            )
            for i in scraped
        ]
    return []

@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    global resume_text_store
    content = await file.read()
    text = ""
    fname = (file.filename or "").lower()
    try:
        if fname.endswith(".pdf"):
            if FITZ_AVAILABLE:
                with fitz.open(stream=content, filetype="pdf") as pdf_doc:  # type: ignore
                    for page in pdf_doc:
                        text += page.get_text()
            else:
                return {"error": "PDF parsing requires PyMuPDF. Please install PyMuPDF or upload DOCX/TXT."}
        elif fname.endswith(".docx"):
            if DOCX_AVAILABLE:
                d = docx.Document(io.BytesIO(content))  # type: ignore
                for para in d.paragraphs:
                    text += para.text + "\n"
            else:
                return {"error": "DOCX parsing requires python-docx. Please install python-docx or upload PDF/TXT."}
        elif fname.endswith(".txt"):
            text = content.decode("utf-8", errors="ignore")
        else:
            return {"error": "Unsupported file format. Use PDF, DOCX, or TXT."}
    except Exception as e:
        return {"error": f"Failed to parse resume: {e}"}
    resume_text_store = text.strip()
    return {"message": "Resume uploaded successfully", "chars": len(resume_text_store)}

@app.post("/api/chat")
def chat_with_ai(req: ChatRequest, id_token: Optional[str] = Header(default=None)):
    # Optional/required auth based on flags
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

    # Determine intent from user message
    msg_l = (req.message or "").lower()
    intent = "general"
    if ("rate" in msg_l and "resume" in msg_l) or ("score" in msg_l and "resume" in msg_l):
        intent = "rate_resume"
    elif "skill gap" in msg_l or "skill-gap" in msg_l or "gap analysis" in msg_l:
        intent = "skill_gap"

    # Build a high-quality prompt with clear formatting instructions
    context = (
        "You are an expert AI career coach for students. You always answer with clear, concise bullet points "
        "and short sentences. Use the user's resume purely as context if provided. Prefer specific, actionable advice.\n\n"
        "Output rules:\n"
        "- Start with a one-line summary.\n"
        "- Use bullet points (\"-\") for steps, tips, lists.\n"
        "- Use short section headers in ALL CAPS when helpful (e.g., SUMMARY, STRENGTHS, GAPS, NEXT STEPS).\n"
        "- Keep to 8-12 bullets total unless asked for more.\n"
    )

    resume_snippet = (resume_text_store or "")[:4000]

    if intent == "rate_resume":
        task = (
            "RATE RESUME OUT OF 10. Consider clarity, impact, relevance, and keywords. "
            "Return: a score like 'Score: 7/10' then bullets for STRENGTHS, IMPROVEMENTS, and NEXT STEPS."
        )
    elif intent == "skill_gap":
        task = (
            "SKILL GAP ANALYSIS from the resume. Bullets for MATCHED SKILLS, MISSING SKILLS, and LEARNING PLAN. "
            "Be specific. If resume is missing, ask the user to upload it first."
        )
    else:
        task = (
            "Answer the user's question about internships, jobs, skills, or resume improvements. "
            "Prioritize actionable steps."
        )

    try:
        # Prefer OpenRouter if available (read env per request)
        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        openrouter_base = os.getenv("OPENROUTER_BASE", "https://openrouter.ai/api/v1/chat/completions")
        openrouter_ref = os.getenv("OPENROUTER_SITE_URL")
        openrouter_title = os.getenv("OPENROUTER_SITE_NAME")

        if openrouter_key:
            logging.info("AI provider: OpenRouter")
            logging.info(f"Trying OpenRouter models: {OPENROUTER_MODELS}")
            # Build messages
            messages = [{"role": "system", "content": context}]
            if resume_snippet:
                messages.append({"role": "system", "content": f"RESUME (optional):\n{resume_snippet}"})
            messages.append({"role": "system", "content": f"TASK: {task}"})
            messages.append({"role": "user", "content": req.message})

            headers = {
                "Authorization": f"Bearer {openrouter_key}",
                "Content-Type": "application/json",
            }
            if openrouter_ref:
                headers["HTTP-Referer"] = openrouter_ref
            if openrouter_title:
                headers["X-Title"] = openrouter_title

            # Try each configured model with retries
            retries = 2
            delay = 5
            for model_name in OPENROUTER_MODELS:
                logging.info(f"OpenRouter model candidate: {model_name}")
                for attempt in range(retries + 1):
                    r = requests.post(
                        openrouter_base,
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
                        text = (
                            data.get("choices", [{}])[0]
                            .get("message", {})
                            .get("content", "")
                        )
                        if text:
                            return {"response": text}
                        break
                    if r.status_code == 429 and attempt < retries:
                        retry_after = r.headers.get("Retry-After")
                        wait = int(retry_after) if retry_after and retry_after.isdigit() else delay
                        wait = min(20, max(3, wait))
                        logging.warning(
                            f"OpenRouter 429 for '{model_name}'. Attempt {attempt+1}/{retries}. Waiting {wait}s..."
                        )
                        time.sleep(wait)
                        continue
                    # Other errors: log and try next model
                    try:
                        err = r.json()
                    except Exception:
                        err = {"error": r.text}
                    logging.warning(f"OpenRouter error {r.status_code} for '{model_name}': {err}")
                    break

            # If all models failed or were rate-limited, return a friendly message
            return {
                "response": (
                    "- SUMMARY: I’m getting rate-limited right now.\n"
                    "- Please retry in 30–60 seconds.\n"
                    "- TIP: Add more models in OPENROUTER_MODELS to reduce rate limits."
                )
            }

        # Fallback to Gemini flash models if OpenRouter is not configured
        logging.info("AI provider: Gemini (flash)")
        gen_config = {
            "temperature": 0.6,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 700,
        }
        model_candidates = [
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
        ]

        prompt = (
            f"{context}\n\nRESUME (optional):\n{resume_snippet}\n\nTASK: {task}\n\nUSER: {req.message}\nASSISTANT:"
        )

        text = None
        last_err: Exception | None = None
        for m in model_candidates:
            retries = 2
            for attempt in range(retries + 1):
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
                        break
                except Exception as e:
                    last_err = e
                    msg = str(e)
                    if "429" in msg or "quota" in msg.lower() or "rate limit" in msg.lower():
                        wait = 5
                        msec = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)\s*\}", msg)
                        if msec:
                            try:
                                wait = min(15, max(3, int(msec.group(1))))
                            except Exception:
                                wait = 5
                        logging.warning(f"Model '{m}' rate-limited. Attempt {attempt+1}/{retries}. Waiting {wait}s...")
                        time.sleep(wait)
                        continue
                    else:
                        logging.warning(f"Gemini model '{m}' failed: {e}")
                        break
            if text:
                break

        if text:
            return {"response": text}
        if last_err:
            return {"response": f"AI error: {last_err}"}
        return {"response": "Sorry, I couldn't generate a response right now."}
    except Exception as e:
        logging.exception("AI error")
        return {"response": f"AI error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)


