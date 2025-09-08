<div align="center">

# Find My Stipend (StudentPilot)

AI‑powered Internship Hunter — a single place to find internships, fix your resume, and practice interviews.

</div>

## Problem
- Students waste 10+ hrs/week searching across scattered platforms.
- Good opportunities are missed.
- Resumes are often weak → low shortlisting chances.
- Interview prep is ad‑hoc and stressful.

## Solution
One AI‑driven platform that:
1) Finds relevant internships automatically.  
2) Improves resumes with AI feedback.  
3) Prepares students with mock interviews.  
4) Sends instant alerts on WhatsApp/Telegram (planned).

## Features
1) Smart Internship Finder
- Input: skills, interests, location  
- Scrapers/AI agents search multiple platforms  
- Matches jobs with resume keywords and ranks results

2) AI Resume Analyzer
- Upload resume → get tips and improvements (PDF/DOCX/TXT supported)

3) Mock Interview Coach
- LLM‑powered Q&A with lightweight audio UX

4) Career Copilot (Agentic)
- Background scout (planned) to push new jobs to dashboard/alerts

5) Instant Alerts (Planned)
- WhatsApp/Telegram bot for stipend + job alerts

6) Skill→Internship Mapping
- Maps resume skills to trending fields; recommends skills to boost chances

7) Gamified Stipend Tracker (Optional)
<div align="center">

# Find My Stipend (StudentPilot)

AI‑powered Internship Hunter — find internships, fix your resume, and practice interviews.

</div>

## Hackathon Quick Links
- One‑shot dev (Windows): `./dev.ps1`
- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:8000 (health: `/health`)
- Smoke test: `python backend/smoke_test.py`

## Problem
- Students waste 10+ hrs/week searching across scattered platforms.
- Good opportunities are missed.
- Weak resumes → low shortlisting chances.
- Interview prep is ad‑hoc and stressful.

## Solution
One AI platform that:
1) Finds relevant internships automatically.
2) Improves resumes with AI feedback.
3) Prepares students with mock interviews.
4) (Planned) Sends instant alerts on WhatsApp/Telegram.

## Features
- Smart Internship Finder (skills, interests, location; ranked results)
- AI Resume Analyzer (PDF/DOCX/TXT)
- Mock Interview Coach (LLM Q&A, audio UX, barge‑in, “Complete Answer”)
- (Planned) Background scout and instant alerts

## Tech Stack
- Frontend: React (Vite) + TypeScript + Tailwind + shadcn/ui
- Backend: FastAPI (Python), PyMuPDF/python‑docx, Requests/BS4 (+ optional Selenium)
- AI: OpenRouter (LLMs), Gemini optional
- Deploy: Vercel (FE), Render/Elastic Beanstalk (BE)

## Architecture
1) Frontend → Backend (FastAPI)
2) Resume parsed → skills/keywords extracted
3) Scrapers + LLM augment queries
4) Results returned progressively (time‑budgeted)

Endpoints:
- `/health`, `/version`, `/api/search`, `/api/upload-resume`, `/api/chat`

## Local Setup
Prereqs: Node 18+, Python 3.10+, PowerShell on Windows.

Option A — one‑shot (Windows):
```powershell
./dev.ps1 -BackendPort 8000 -FrontendPort 5173 -KillRange
```

Option B — manual (Windows):
```powershell
# Backend
cd backend
pip install -r requirements.txt
# Configure env (see backend/.env example below)
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (new terminal at repo root)
npm install
$env:VITE_API_BASE = 'http://127.0.0.1:8000'
npm run dev
```

macOS/Linux (manual):
```bash
cd backend && pip install -r requirements.txt
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
cd .. && npm install
export VITE_API_BASE=http://127.0.0.1:8000
npm run dev
```

Open http://127.0.0.1:5173.

## Environment
Backend (`backend/.env`):
```
PORT=8000
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODELS=deepseek/deepseek-chat-v3-0324:free
OPENROUTER_BASE=https://openrouter.ai/api/v1/chat/completions
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# Optional knobs
DISABLE_LINKEDIN=1           # off by default (heavy)
SEARCH_TIME_BUDGET=6.0       # seconds; returns partials fast
OFFLINE_MODE=0               # 1 disables LLM replies
FRONTEND_ORIGIN=http://127.0.0.1:5173
```
Frontend (optional):
```
VITE_API_BASE=http://127.0.0.1:8000
```

## REST API (cheatsheet)
- GET `/health` → `{ status: "ok" }`
- GET `/version` → `{ version, commit, openrouter }`
- POST `/api/search` → `{ query, filters }` → `Internship[]`
- POST `/api/upload-resume` (multipart) → `{ skills[], roles[], location? }`
- POST `/api/chat` → `{ response }` (LLM when OpenRouter configured)

## Smoke Test
```powershell
python backend/smoke_test.py
```
Checks `/health`, `/api/search`, `/api/chat` with PASS/FAIL.

## 3‑min Demo Script
- 0:00–0:30: Problem → solution; arch diagram.
- 0:30–1:30: Upload resume → extracted skills → search (spinners, partial results).
- 1:30–2:30: Mock Interview → barge‑in → “Complete Answer” → feedback.
- 2:30–3:00: Roadmap (alerts) + impact.

## Troubleshooting
- If CORS errors, include your FE origin in `CORS_ORIGINS`.
- If PDF parsing fails, install PyMuPDF or upload DOCX/TXT.
- On Windows, use scripts (`./dev.ps1`, `./start_backend.ps1`) instead of inline python lines.

## Impact
- Saves time (no platform hopping)
- Boosts confidence (practice + feedback)
- Increases access (single, AI‑assisted hub)

## Team
- Frontend, Backend, AI, DevOps roles — see repo commits.

## Credits
Made by Shriya Gakkhar and Ruchin Audichya. MIT License.
