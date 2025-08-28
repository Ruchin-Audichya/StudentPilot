<div align="center">

# StudentPilot (Where’s My Stipend) 💸

[![Live Demo](https://img.shields.io/badge/Live%20Demo-StudentPilot-blue?style=for-the-badge)](https://studentpilot.vercel.app)

Career + internship copilot: upload a resume, instantly extract skills & roles, fetch fresh internships, and chat with an AI tuned for concise, actionable career advice.

![Hero](./src/assets/hero-nexus.jpg)

</div>

## Highlights
| Area | What You Get |
|------|--------------|
| Resume Intelligence | PDF / DOCX / TXT parsing, skill + role auto‑extraction |
| Multi‑Source Feed | Internshala scraper (extensible), de‑duplication, scoring |
| Scoring Heuristics | Skill coverage, distinct term density, role & stipend boosts |
| UX Signals | Hot (>=85 pre‑normalized), New (recent posting cues) |
| AI Assistant | Resume‑aware (if uploaded) OpenRouter chat, fallback graceful |
| Skill Gap | Target track detection and gap plan (frontend/back/data/etc) |
| Firebase (Optional) | Anonymous auth + Firestore profile + backend user log ping |

## Updated Stack
Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui + React Query  
Backend: FastAPI, Requests, BeautifulSoup, optional Selenium (feature‑flag)  
Parsing: python-docx, PyMuPDF (optional)  
AI: OpenRouter (model list via `OPENROUTER_MODELS`)  
Deployment: Vercel (frontend) + Render (backend)
Auth/Data: Firebase (anonymous) – optional; app still works without it.

---

## 🚀 Quick Start

### Frontend
```sh
npm install
npm run dev
```

### Backend
```sh
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

- Make sure both servers are running and connected via `VITE_API_BASE` (see below).
- Visit: http://localhost:5173

---

## 🌐 Environment Variables

### Frontend
- `VITE_API_BASE`: The backend API base URL (e.g. `http://127.0.0.1:8000` for local dev, or your Render/EB URL for production).

### Backend
- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI chat.
- `OPENROUTER_MODELS`: Comma-separated list of model IDs (e.g. `openai/gpt-oss-20b:free,qwen/qwen3-coder:free`). First entry is default.
- `CORS_ORIGINS`: Comma-separated list of allowed origins (e.g. `https://yourapp.vercel.app,https://foo.app`).
- `FRONTEND_ORIGIN`: Strict CORS allowlist for frontend.
- `DISABLE_LINKEDIN`: Set to `1` to skip Selenium scraping.

---

## ✨ Key UI Features
- Glassmorphic design across chat, auth, dashboard.
- Streaming chat replies (real-time AI output).
- Markdown-rendered messages in chat bubbles.
- Resume badge toggle and model switcher in chat header.
- Mobile-first, responsive layout for all screens.

---

## 🛠️ Developer Guide
- Folder layout:
  - `src/components`: All UI components (chat, dashboard, onboarding, etc.)
  - `src/services`: API clients and business logic
  - `src/pages`: Top-level pages/routes
  - `src/assets`: Images and static assets
- Copilot guardrail: See `.copilot-instructions.md` for agent rules and best practices.
- Styling: Use `wm-*` classes for custom glass styles. Never duplicate Tailwind utilities—compose with classes instead.

---

## 🚢 Deployment

### Frontend (Vercel)
- Automatic deploy on push to `main` branch.
- Quick push:
```sh
git add src/components/Dashboard.tsx src/components/ChatWidget.tsx src/services/chatApi.ts
git commit -m "fix(chat): correct OpenRouter payload, resume badge logic, and header alignment"
git push origin main
```
- Set `VITE_API_BASE` in Vercel project settings to your backend URL if needed.

### Backend (Elastic Beanstalk / Render)
- Elastic Beanstalk: See below for Docker setup and environment variables.
- Render: Connect repo, set Python runtime, add env vars, deploy. Health check at `/health`.

---

## Existing Sections

<!-- All previous content below remains unchanged, including environment variable tables, deployment details, Firebase integration, AI chat, fallback behavior, cleaning, testing, roadmap, demo flow, architecture, license, and credits. -->

## Environment Variables
Backend (set in Render dashboard):
| Name | Purpose | Example |
|------|---------|---------|
| OPENROUTER_API_KEY | Enables AI chat augmentation | sk-or-... |
| OPENROUTER_MODELS | Comma list of model IDs | qwen/qwen3-coder:free |
| FRONTEND_ORIGIN | Strict CORS allowlist | https://yourapp.vercel.app |
| DISABLE_LINKEDIN | Skip Selenium scraping | 1 |
| CORS_ORIGINS | Extra allowed origins | https://foo.app,https://bar.dev |

### Deployment Environment Variables

Elastic Beanstalk (Console → Environment → Configuration → Software → Environment properties):
```
CORS_ORIGINS=https://wms-virid-six.vercel.app
FRONTEND_ORIGIN=https://wms-virid-six.vercel.app
DISABLE_LINKEDIN=1
OPENROUTER_API_KEY=<your-key>
```

Railway (Project → Variables):
```
CORS_ORIGINS=https://wms-virid-six.vercel.app
FRONTEND_ORIGIN=https://wms-virid-six.vercel.app
DISABLE_LINKEDIN=1
OPENROUTER_API_KEY=<your-key>
```

Procfile uses dynamic port binding (`${PORT:-8000}`) so Railway injects a runtime port while EB keeps default 8000.

Frontend (Vercel env):
| Name | Purpose |
|------|---------|
| VITE_API_BASE | Override API base (optional) |
| VITE_FIREBASE_* | Firebase config keys (optional) |

## Deployment (Backend)
### AWS Elastic Beanstalk (Docker)
1. Ensure `backend/Dockerfile` (already present) builds locally: `docker build -t studentpilot-backend .` from repo root.
2. Create EB Python/Docker env → upload container app (or use EB CLI with Dockerrun from root).
3. Set env vars: `OPENROUTER_API_KEY`, `DISABLE_LINKEDIN=1`, `FRONTEND_ORIGIN=https://<vercel-domain>`.
4. Health check path: `/health`.
5. (Optional) Turn on enhanced health for faster fail detection.

### Render (Free Tier) – Simplest Backend Deploy
Render reads `render.yaml` (already in repo) so you can accept most defaults:
1. New Web Service → Connect GitHub repo.
2. Select Root Directory: `backend` (or leave auto if detected by render.yaml).
3. Runtime: Python 3.x (latest).
4. Build Command: `pip install -r requirements.txt`
5. Start Command (if not auto-filled):
	`gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT --workers 3 --timeout 120`
6. Env Vars (add now): `OPENROUTER_API_KEY` (secret), `CORS_ORIGINS`, `FRONTEND_ORIGIN`, `DISABLE_LINKEDIN=1`.
7. Deploy → confirm health: visit `https://studentpilot.onrender.com/health` expecting `{"status": "ok"}`.

Frontend (Vercel):
1. Set (optionally) `VITE_API_BASE` to your backend origin or leave blank to use development defaults.

## Firebase Integration
- Anonymous user ensured on onboarding.
- After onboarding save, frontend posts `/api/log-user` with uid + anonymous flag → simple in‑memory rolling log (no PII persisted server‑side).
- If Firebase envs missing, app still runs (logging simply no‑ops).

## AI Chat
1. Provide `OPENROUTER_API_KEY`.
2. Optional: customize `OPENROUTER_MODELS` (first entry used).
3. Chat endpoint blends heuristic guidance + model output; if AI call fails you see an `AI NOTE` line.

## Fallback / Offline Behavior
- If scraping yields zero jobs (blocked / network issue) backend now emits clear SAMPLE listings (source=`sample`) so UI remains functional.
- Disable by removing the fallback block in `main.py` if undesired.

## Cleaning & Slimming (Done)
- Removed unused dependency `rapidfuzz`.
- PowerShell dev helper scripts removed on request.
- Added `/api/log-user` endpoint & frontend hook.
- Requirements file grouped & commented.

## Testing (Manual Smoke)
```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:8000/api/search -Body (@{query='python'; filters=@{location='India'}} | ConvertTo-Json) -ContentType 'application/json'
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:8000/api/chat -Body (@{message='Rate my resume'} | ConvertTo-Json) -ContentType 'application/json'
```

## Roadmap (Next Polishing Steps)
- Persist user resume/profile per UID (currently global in‑memory)  
- Pagination & caching layer for search results  
- Basic pytest suite + GitHub CI  
- Add additional sources (LinkedIn refined, AngelList)  
- Replace heuristic scoring with embedding similarity  

## Demo Flow (For Judges)
1. Open the hosted frontend (Vercel) – point out Backend status indicator.
2. Upload `backend/test_resume.txt` (works even as .txt) – watch extracted skills appear.
3. Run a search (e.g. "python" / keep location India) – highlight scoring & tags.
4. Ask Chat: "Skill gap for backend" then "Rate my resume" – show AI augmentation.
5. (Optional) Toggle network throttling / show fallback SAMPLE listings resilience.
6. Mention extensibility: new scrapers just need to return a list of job dicts.

## Architecture Snapshot
```
frontend (Vercel) --> backend (FastAPI on Render)
										 |--> /health
										 |--> /api/search (scrapers + scoring)
										 |--> /api/upload-resume (parse + profile)
										 |--> /api/chat (heuristics + OpenRouter)
										 |--> /api/log-user (anon usage ping)
```

## License
MIT (see LICENSE)

## Credits
Built by Ruchin Audichya & Shriya Gakkhar. If this helps you, star ⭐ the repo.

---
Internship search should feel empowering—this project is our step toward that.

# bump
