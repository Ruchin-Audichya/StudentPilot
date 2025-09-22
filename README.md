<div align="center">

  <img src="./public/wms-mascot.svg" alt="Find My Stipend Mascot" width="120" height="120" />

  <h1>Find My Stipend — Smart India Hackathon Edition</h1>
  <p>Find internships faster. Close skill gaps. Connect with recruiters. Get placed.</p>

  <p>
    <a href="#sih-brief"><img alt="sih" src="https://img.shields.io/badge/SIH-Submission-7A5CFF?style=for-the-badge"/></a>
    <a href="#quickstart"><img alt="quickstart" src="https://img.shields.io/badge/Quickstart-2%20mins-5AD7FF?style=for-the-badge"/></a>
    <a href="#demo"><img alt="demo" src="https://img.shields.io/badge/Demo-links-00C2A8?style=for-the-badge"/></a>
    <a href="#license"><img alt="license" src="https://img.shields.io/badge/License-MIT-00C2A8?style=for-the-badge"/></a>
  </p>

  <img src="./public/posters/Poster 1.png" alt="Hero" width="720" />
</div>

![Campus Connect Hero](assets/campus-connect-hero.png)


This repository contains the working prototype of Find My Stipend (FMS), prepared for Smart India Hackathon. It blends multi‑source internship discovery with resume‑aware ranking, an AI resume analyzer, one‑click portfolio generation, and recruiter‑connect tooling. We also include a placement‑cell workflow (postings, approvals, interviews, dashboard) to support campus processes.

## SIH Brief and Track Mapping {#sih-brief}
- Theme: Smart Education / Employment
- Problem fit: Helping students discover relevant opportunities, assess readiness, and connect with real recruiters in less time
- Stakeholders: Students, Placement Cell, Recruiters
- What’s unique:
  - Resume‑aware ranking across sources (Internshala, LinkedIn, company ATS pages)
  - Practical HR connect tooling (recruiter search/profiles) that works without private APIs
  - Instant portfolio ZIP and resume analyzer to close gaps fast
  - Placement workflows (mentor approvals, interview scheduler with timetable blocks, KPI dashboard)

## Demo {#demo}
- Frontend (Vercel): https://wms-virid-six.vercel.app
- Backend Health (Render): https://studentpilot.onrender.com/health
- Screenshare Script: Upload resume → Analyzer → HR Links → Jobs → Apply → Interview Scheduler → Portfolio ZIP → Placement Dashboard.

### Posters

These are used in the landing page carousel (place files under `public/posters/`).

<div align="center">

<img src="public/posters/Poster 1.png" alt="Poster 1" width="420"/>

<img src="public/posters/Poster 2.png" alt="Poster 2" width="420"/>

<img src="public/posters/Poster 3.png" alt="Poster 3" width="420"/>

</div>

## Architecture Overview
- Frontend: React (Vite) + TypeScript + Tailwind/shadcn + Framer Motion
- Backend: FastAPI (Python), modular routers, JSON persistence for demo
- Scrapers: Internshala, LinkedIn (HTTP‑first), Company ATS (Lever/Greenhouse/Workday/SmartRecruiters), generic pages
- Analytics: Department‑wise KPIs, applications per department
- DevOps: Render (BE), Vercel (FE); health/CORS ready

## Key Features
- Internship Search (multi‑source) with resume relevance score and filters
- Resume Genius (keywords coverage, weak points, grammar fixes)
- AI Portfolio Generator (template and full‑site ZIP)
- Recruiter Connect (search links and public profiles)
- Placement System: Postings, Applications, Mentor approvals, Interview Scheduler, Feedback, Certificates, Dashboard

## Quickstart (Local)

Prereqs: Node 18+, Python 3.11+, Git

```powershell
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8011 --reload

# Frontend (new terminal at repo root)
npm install
$env:VITE_API_BASE = 'http://127.0.0.1:8011'
npm run dev
```

Open http://127.0.0.1:5173. Health: GET http://127.0.0.1:8011/health

## REST Endpoints (selected)
- GET `/health`, `/version`
- Resume Analyzer: POST `/api/analyze/resume-vs-jobs`
- Internships Multi‑source: POST `/api/search`
- Recruiter Links/Profiles: POST `/api/linkedin/hr-links`, `/api/linkedin/hr-profiles`
- Portfolio: POST `/api/portfolio/generate`
- Placement: `/api/postings`, `/api/applications`, `/api/interviews`, `/api/feedback`, `/api/dashboard`

## Testing
```powershell
pytest -q -k "analyzer or messages"    # quick slice
npm run build                           # FE production build
```

## Submission Notes
- Works offline with JSON storage for demo (no external DB required)
- Env keys are optional; if missing, features fall back to heuristic templates
- CORS is configured; health endpoint exposed
- Code is structured for extension with a real DB later

## License
MIT — © 2025 Find My Stipend team
	- Missing keywords, AI-flagged weak points, grammar fixes
- Smooth UI
	- React + Vite + TypeScript + Tailwind/shadcn; animations via Framer Motion

## Demo Shots

<details>
<summary>Dashboard — Search & Filters</summary>

![Dashboard](./public/placeholder.svg)

</details>

<details>
<summary>Recruiter Profiles — Grouped by Company</summary>

![Recruiters](./public/placeholder.svg)

</details>

<details>
<summary>Instant Portfolio — AI ZIP Download</summary>

![Portfolio](./public/placeholder.svg)

</details>

## Architecture
- Frontend: React (Vite) + TypeScript + Tailwind/shadcn
	- `src/services/*` for API calls, `src/components/*` for UI (Dashboard, JobCard, HR panels)
- Backend: FastAPI
	- Scrapers: Internshala, LinkedIn (HTTP-first with fallback), ATS (Lever/Greenhouse/SmartRecruiters/Workday), Generic
	- Routes: `/api/search`, `/api/upload-resume`, `/api/portfolio/generate`, `/api/linkedin/hr-links`, `/api/linkedin/hr-profiles`, `/api/linkedin/hr-profiles/batch`
	- AI: OpenRouter (chat/analyzer) and Gemini proxy (portfolio)
	- Render-friendly; CORS and health endpoints

## Quickstart

Prereqs: Node 18+, Python 3.11+, Git

```powershell

<br/>

<img alt="Hero" src="public/placeholder.svg" width="680"/>

</div>

## ✨ What it does
- Finds real internships from multiple sources (Internshala, LinkedIn, company careers like Lever/Greenhouse/SmartRecruiters/Workday) and ranks them to your resume.
- Improves your resume with AI: keyword coverage, missing terms, weak points, grammar fixes.
- Conducts smart mock interviews (5–6 questions) that adapt to your answers and resume.
- Helps you connect with HRs/recruiters via relevant LinkedIn search links.
- Generates tailored cover letters/connection notes.
- One‑click “Instant Portfolio” ZIP for Vercel/GitHub Pages.
- Real student hiring stories — share your blurred offer letter testimonial from the homepage.

## 🧠 Feature highlights
- Internship Search
	- LinkedIn optional path; ATS company careers coverage (Lever/Greenhouse/SmartRecruiters/Workday) with generic fallback
- Resume Genius
	- Rule‑based scoring (0–100) + missing keywords list
	- AI enrichment (suggestions, weak points, grammar) via OpenRouter/Gemini
- Mock Interview
	- Session‑aware: reads your uploaded resume
	- Generates 5–6 simple, practical questions (2 behavioral + technical aligned to skills)
- Messages
	- Short cover letters/LinkedIn notes (LLM fallback to template)
- Instant Portfolio
- Testimonials
	- “Got Hired via FindMyStipend?” submission (image + note); grid showcased on homepage

## 🏗️ Tech
- Backend: FastAPI (Python), Requests+BS4, PyMuPDF/python‑docx, optional Playwright/Selenium
- Deploy: Vercel (FE), Render/EB (BE)

## 🖼️ Screens (add your screenshots)
- Dashboard: analyzer, HR links, ranked jobs
- Testimonials: success stories grid

## ⚙️ Quickstart (Windows)
```powershell
./dev.ps1 -BackendPort 8000 -FrontendPort 5173 -KillRange
```

Manual setup
```powershell
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (new terminal at repo root)
npm install
$env:VITE_API_BASE = 'http://127.0.0.1:8000'
npm run dev
```

macOS/Linux
```bash
cd backend && pip install -r requirements.txt
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
cd .. && npm install
export VITE_API_BASE=http://127.0.0.1:8000
npm run dev
```

Open http://127.0.0.1:5173.

## 🔐 Environment
Backend (`backend/.env`)
```
PORT=8000
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODELS=deepseek/deepseek-chat-v3-0324:free,meta-llama/llama-3.1-8b-instruct:free
OPENROUTER_BASE=https://openrouter.ai/api/v1/chat/completions
FRONTEND_ORIGIN=http://127.0.0.1:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# Options
DISABLE_LINKEDIN=1
SEARCH_TIME_BUDGET=14.0
SEARCH_MAX_QUERIES=10
SEARCH_PER_QUERY_LIMIT=20
```
Frontend (optional)
```
VITE_API_BASE=http://127.0.0.1:8000
```

## 🔌 REST cheatsheet
- GET `/health`, `/version`
- POST `/api/upload-resume` (multipart)
- POST `/api/search` → internship list with `score` and `is_new`
- Company careers
	- POST `/api/internships/scrape`
	- POST `/api/internships/scrape-batch`
- LinkedIn tools
	- POST `/api/linkedin/hr-links`
- Resume Analyzer
	- POST `/api/analyze/resume-vs-jobs`
- Messages
	- POST `/api/messages/cover-letter`
- Portfolio
	- POST `/api/portfolio/generate`
- Mock Interview
	- POST `/api/mock-interview/start`
	- POST `/api/mock-interview/followup`
- Testimonials
	- GET/POST `/api/testimonials`
	- GET `/api/testimonials/image/{filename}`

## 🧪 Smoke tests
```powershell
python backend/smoke_test.py
```
Optional:
```powershell
pytest -q -k "analyzer or messages or portfolio"
```

## 🗺️ 3‑min pitch
- Pain → Vision → Demo: upload resume → analyzer → HR links → search results (Apply Now) → mock interview (speak, barge‑in, feedback) → one‑click portfolio → real testimonials.
- Impact: saves time, increases call‑backs, boosts confidence.

## 🛠️ Troubleshooting
- CORS: include your FE origin in `CORS_ORIGINS`.
- PDF parsing: install PyMuPDF; DOCX/TXT are supported.
- LinkedIn blocked? Set `DISABLE_LINKEDIN=1`.
- Slow search? Tune `SEARCH_TIME_BUDGET`, reduce `SEARCH_MAX_QUERIES`.

## 🏁 License & Credits
MIT — Made by Shriya Gakkhar and Ruchin Audichya.
