import os
import io
import fitz  # PyMuPDF
import docx
import google.generativeai as genai
from fastapi import FastAPI, File, UploadFile, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import firebase_admin
from firebase_admin import credentials, auth


from scrapers.internshala import fetch_internships
from scrapers.linkedin import fetch_linkedin_internships

from dotenv import load_dotenv
import csv
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("GOOGLE_API_KEY not found in environment variables")

genai.configure(api_key=GOOGLE_API_KEY)

app = FastAPI()


# Initialize Firebase Admin SDK

cred = credentials.Certificate("firebase-adminsdk.json")
firebase_admin.initialize_app(cred)


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
    internshala_results = fetch_internships(q or "intern", location=location)
    linkedin_results = fetch_linkedin_internships(q or "intern", location=location)

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
    if file.filename.lower().endswith(".pdf"):
        with fitz.open(stream=content, filetype="pdf") as pdf_doc:
            for page in pdf_doc:
                text += page.get_text()
    elif file.filename.lower().endswith(".docx"):
        doc = docx.Document(io.BytesIO(content))
        for para in doc.paragraphs:
            text += para.text + "\n"
    elif file.filename.lower().endswith(".txt"):
        text = content.decode("utf-8", errors="ignore")
    else:
        return {"error": "Unsupported file format"}
    resume_text_store = text.strip()
    return {"message": "Resume uploaded successfully", "chars": len(resume_text_store)}

@app.post("/api/chat")
def chat_with_ai(req: ChatRequest):
    context = (
        "You are a helpful career assistant. Use the user's resume only for context. "
        "Answer internship/job related queries concisely with actionable steps."
    )
    prompt = f"{context}\n\nResume (optional):\n{resume_text_store[:4000]}\n\nUser: {req.message}"
    try:
        # Gemini models: prefer 1.5 flash for speed; fall back to 1.5 pro if needed
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        text = getattr(resp, "text", None)
        if not text:
            # Some SDKs return candidates
            cands = getattr(resp, "candidates", [])
            if cands and getattr(cands[0], "content", None):
                parts = getattr(cands[0].content, "parts", [])
                text = "".join(getattr(p, "text", "") for p in parts)
        return {"response": text or "Sorry, I couldn't generate a response right now."}
    except Exception as e:
        return {"response": f"AI error: {str(e)}"}


# Auth logic
# main.py
# Define the authentication dependency
async def get_current_user(id_token: str = Header(...)):
    try:
        # Verify the ID token using the Firebase Admin SDK
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        # If verification fails, raise an HTTPException
        raise HTTPException(status_code=401, detail=f"Invalid authentication credentials: {e}")
@app.post("/api/chat")
def chat_with_ai(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    # You can now access the user's information from the decoded token
    user_uid = current_user.get('uid')
    user_email = current_user.get('email')
    
    # Your existing chat logic
    context = (
        "You are a helpful career assistant. Use the user's resume only for context. "
        "Answer internship/job related queries concisely with actionable steps."
    )
    prompt = f"{context}\n\nResume (optional):\n{resume_text_store[:4000]}\n\nUser: {req.message}"
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        # ... (rest of the code)
        return {"response": "Sorry, I couldn't generate a response right now."}
    except Exception as e:
        return {"response": f"AI error: {str(e)}"}

# Initialize Firebase Admin SDK
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)


