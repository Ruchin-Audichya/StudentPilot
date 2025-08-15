<div align="center">

# Where’s My Stipend 💸

Find paid internships that actually match your skills — upload your resume, set your interests, and let the app surface the best fits from across the web.

<br/>

![Hero](./src/assets/hero-nexus.jpg)

</div>

## 🧩 Problem Statement

Students waste countless hours hunting through job boards for relevant internships. Most results are noisy, unpaid, or poorly matched. Where’s My Stipend automates discovery by parsing your resume and preferences, then matching you with paid internships that fit — fast.

## ✨ Features

- Resume upload & parsing (PDF/DOCX/TXT) to auto-extract skills and roles
- LinkedIn + Internshala scraping for a broader, fresher pool of internships
- Buzzword-driven query expansion tuned for student/early-career roles
- Match percentage scoring so you can prioritize the best fits
- Tags for Hot/New jobs to highlight urgency and recency
- Optional: friendly, resume‑aware chat that explains your profile and gives quick tips

## 🛠 Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, framer-motion
- Backend: FastAPI, Uvicorn + Gunicorn, Selenium (Chromium + Chromedriver), BeautifulSoup4, Requests
- Resume parsing: PyMuPDF (PDF), python-docx (DOCX)
- Matching: scikit-learn, rapidfuzz; CSV‑based buzzwords for query expansion
- AI (optional): google-generativeai, OpenRouter multi-model strategy
- Data & Auth (optional): Firebase Auth (Anonymous + Email/Password), Firestore, Storage
- DevOps: Docker, AWS Elastic Beanstalk (single Docker container), Nginx health checks

## 📦 Installation

Prerequisites:
- Node.js 18+ and npm
- Python 3.11+

Clone:
```powershell
git clone https://github.com/Ruchin-Audichya/StudentPilot.git
cd StudentPilot
```

Environment variables (don’t commit secrets):
- Copy `.env.example` → `.env.local` for the frontend.
- Copy `backend/.env.example` → `backend/.env` for the backend.

### 🔑 Environment variables quick reference

- Frontend (Vite) reads from `import.meta.env.*` (must be prefixed with `VITE_`).
	- `VITE_API_BASE` → used in `src/api.ts` and `src/services/jobApi.ts` to call your backend.
	- `VITE_FIREBASE_*` → used in `src/lib/firebase.ts` for Firebase Web SDK (Auth/Firestore/Storage).
		- If any critical Firebase key is missing, we log a clear warning and avoid initializing modules to prevent runtime crashes.

- Backend (FastAPI) reads process env variables (12-factor style):
	- `OPENROUTER_*` → preferred AI provider for chat; configured in `backend/main.py` (current chat is local/resume-aware, keys are optional).
	- `GOOGLE_API_KEY` → optional Gemini fallback.
	- `FIREBASE_*` → optional Admin SDK (project ID, client email, and private key) if server needs to verify tokens or write to Firestore.
	- `PORT` → honored by Gunicorn in `backend/Dockerfile` and EB config.

For Netlify/Vercel/Amplify: set the `VITE_*` variables in the dashboard UI. For the backend (EB/Render/ECS), set server env variables there. The repo includes `netlify.toml`, `vercel.json`, and `backend/.ebextensions` to smooth defaults.

Frontend `.env.local` (example):
```
VITE_API_BASE=http://127.0.0.1:8011

# Firebase (optional)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Backend `backend/.env` (example):
```
# Prefer OpenRouter; fallback to Gemini if not set
OPENROUTER_API_KEY=
OPENROUTER_MODELS=qwen/qwen3-coder:free, google/gemma-2-9b-it:free
OPENROUTER_BASE=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_SITE_NAME=StudentPilot

# Optional Gemini fallback
GOOGLE_API_KEY=
```

## 🧑‍💻 Local Development

Backend (FastAPI):
```powershell
cd backend
python -m venv .venv; . .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8011
```

Frontend (Vite):
```powershell
npm install
npm run dev
```

- App: http://127.0.0.1:5173 (or the port Vite prints)
- API: http://127.0.0.1:8011

## 🚀 Deployment (AWS Elastic Beanstalk + Docker)

The backend ships with a production Dockerfile (`backend/Dockerfile`) that installs Chromium + Chromedriver for Selenium, runs Gunicorn with Uvicorn workers, and honors the `PORT` env.

High‑level steps with EB CLI (from `backend/`):
```powershell
eb init   # choose region, app name, Docker platform (AL2023)
eb create studentpilot-api-prod --single
eb setenv PORT=8000 WORKERS=2 TIMEOUT=120 `
	OPENROUTER_API_KEY=... GOOGLE_API_KEY=... `
	FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=...
eb deploy
eb open
```

- Health check: `GET /health` (configured via `.ebextensions` and Nginx snippet)
- Files: see `backend/.ebextensions` for env/port/health settings

## 🖼️ Screenshots

![Landing](docs/screenshots/landing.png)
![Dashboard](docs/screenshots/dashboard.png)
![Onboarding](docs/screenshots/onboarding.png)

## � Future Improvements

- AI career coach that explains why each internship matches and gives prep tips
- Semantic job matching using sentence embeddings (e.g., sentence-transformers)
- Job alerts (email/WhatsApp) when new matches appear
- Visual analytics: skill match graph, internship categories pie chart
- Gamification: badges for applying, completing profile, streaks, etc.
- More sources: AngelList, Naukri, direct company careers pages
- Offline mode for cached results and smoother UX

## 🤝 Contributing

Contributions are welcome! Please fork the repo and open a PR:
1. Create a feature branch
2. Make your changes with tests where relevant
3. Run lint/build locally
4. Open a Pull Request with a clear description and screenshots

## 📄 License

This project is provided as-is for learning and prototyping. You can adopt MIT or your preferred license when ready (add a LICENSE file).

## 📢 What’s New (Latest Improvements)

- Backend Dockerfile for production: Chromium + Chromedriver, Gunicorn/Uvicorn, `PORT` support
- AWS Elastic Beanstalk configs: `.ebextensions`, `/health` endpoint, Nginx proxy for health
- LinkedIn scraper via Selenium (headless Chrome) alongside Internshala; balanced, de-duplicated results
- Buzzword‑driven query expansion and per‑source score normalization
- Resume‑aware chat endpoint (identity summary, resume rating, skill gap analysis)
- Visual overhaul: Landing animations, modern Dashboard with JobCard (New/Hot badges, match score bar)
- Anonymous onboarding + Firestore writes; account linking on email login
- Firebase initialization hardening and Storage helpers for resume upload

## 🙌 Credits

- Lead Developer & UX: [Ruchin Audichya](https://github.com/Ruchin-Audichya)
- Product & UX, QA: [Shriya Gakkhar](https://github.com/shriya-gakkhar1)

If you find this useful, ⭐ the repo and share feedback!
