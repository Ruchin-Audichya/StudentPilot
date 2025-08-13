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
import google.generativeai as genai

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
load_dotenv()
logging.basicConfig(level=logging.INFO)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("GOOGLE_API_KEY not found in environment variables")

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

    context = (
        "You are a helpful career assistant. Use the user's resume only for context. "
        "Answer internship/job related queries concisely with actionable steps."
    )
    prompt = f"{context}\n\nResume (optional):\n{resume_text_store[:4000]}\n\nUser: {req.message}"
    try:
        # Gemini models: prefer 1.5 flash for speed
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        text = getattr(resp, "text", None)
        if not text:
            cands = getattr(resp, "candidates", [])
            if cands and getattr(cands[0], "content", None):
                parts = getattr(cands[0].content, "parts", [])
                text = "".join(getattr(p, "text", "") for p in parts)
        return {"response": text or "Sorry, I couldn't generate a response right now."}
    except Exception as e:
        return {"response": f"AI error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)


