# main.py - Full Feature + Speed + Variety + Buzzword Expansion

import os
import io
import csv
import re
import fitz
import docx
from typing import List, Dict, Optional
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor, as_completed
from pydantic import BaseModel
from datetime import datetime, timedelta

from scrapers.internshala import fetch_internships
from scrapers.linkedin import fetch_linkedin_internships

# -----------------------------
# App Setup
# -----------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

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

def _score_job(job: Dict, profile: Dict) -> float:
    text = f"{job.get('title','')} {job.get('description','')}".lower()
    score = 0
    for skill in profile["skills"]:
        if skill in text:
            score += 1
    for role in profile["roles"]:
        if role in text:
            score += 2
    return min(100, score * 10)

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
# Models
# -----------------------------
class Filters(BaseModel):
    location: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    filters: Filters

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

# -----------------------------
# Search Endpoint
# -----------------------------
@app.post("/api/search", response_model=List[Internship])
def search_internships(req: SearchRequest):
    global resume_text, resume_profile
    user_q = (req.query or "").strip()
    location = (req.filters.location or resume_profile.get("location") or "India")

    # Blended queries: user + resume + buzzword roles + fallback
    queries = set()
    if user_q:
        queries.add(user_q)
    if resume_profile["roles"]:
        for role in list(resume_profile["roles"])[:2]:
            queries.add(f"{role} internship")
    if resume_profile["skills"]:
        queries.add(" ".join(list(resume_profile["skills"])[:3]) + " internship")
    for role in list(buzzword_roles)[:5]:  # limit expansion
        queries.add(f"{role} internship")
    queries.add("internship")  # fallback

    # Run scrapers in parallel
    all_jobs = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = []
        for q in queries:
            futures.append(executor.submit(fetch_internships, q, location))
            futures.append(executor.submit(fetch_linkedin_internships, q, location))
        for f in as_completed(futures):
            try:
                jobs = f.result()
                if jobs:
                    all_jobs.extend(jobs)
            except Exception:
                pass

    if not all_jobs:
        return []

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
# Resume Upload Endpoint
# -----------------------------
@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    global resume_text, resume_profile
    content = await file.read()
    text = ""
    fname = file.filename.lower()

    if fname.endswith(".pdf"):
        with fitz.open(stream=content, filetype="pdf") as pdf:
            for page in pdf:
                text += page.get_text()
    elif fname.endswith(".docx"):
        doc = docx.Document(io.BytesIO(content))
        for para in doc.paragraphs:
            text += para.text + "\n"
    elif fname.endswith(".txt"):
        text = content.decode("utf-8", errors="ignore")
    else:
        return {"error": "Unsupported format"}

    resume_text = _normalize(text)
    resume_profile = {
        "skills": set(_extract_keywords(resume_text)),
        "roles": set(_extract_roles(resume_text)),
        "location": _extract_location(resume_text),
    }
    return {
        "message": "Resume uploaded",
        "skills": list(resume_profile["skills"]),
        "roles": list(resume_profile["roles"])
    }

# -----------------------------
# Dev server
# -----------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", 8000)))
