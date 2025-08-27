<div align="center">

# StudentPilot (Where’s My Stipend) 💸

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
Deployment: Vercel (frontend) + AWS Elastic Beanstalk or Render (backend)  
Auth/Data: Firebase (anonymous) – optional; app still works without it.

## Quick Start (Local)
Backend:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DISABLE_LINKEDIN='1'   # keep Selenium off locally
# (optional) $env:OPENROUTER_API_KEY='sk-or-...'
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Frontend (new terminal):
```powershell
npm install
$env:VITE_API_BASE='http://127.0.0.1:8000'
npm run dev
```
Visit: http://localhost:5173

Upload a resume → see extracted skills (hit `/api/resume-status`) → search internships → chat.

## Environment Variables
Backend (set in EB / Render dashboard):
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

### Render (Free Tier) – Simpler
1. New Web Service → Connect GitHub repo → Root Directory: `backend`.
2. Runtime: Python 3.11.
3. Build Command:
	`pip install -r requirements.txt`
4. Start Command:
	`uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add env vars (same as EB). Keep `DISABLE_LINKEDIN=1` to avoid Selenium.
6. After deploy, verify `https://<service>.onrender.com/health` returns `{ "status": "ok" }`.

Frontend (Vercel):
1. Set (optionally) `VITE_API_BASE` to your backend origin or leave blank to use development defaults.
2. If using a proxy route, adjust rewrites in `vercel.json` accordingly.

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
frontend (Vercel) --> /api/backend/* rewrite --> backend (FastAPI on EB/Render)
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
