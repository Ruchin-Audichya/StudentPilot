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

## 🛠 CI/CD: Elastic Beanstalk Deployment (Backend)

### GitHub Secrets Required
Set these in your repository Settings > Secrets and variables > Actions:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION` (e.g. ap-south-1)

### Workflow
A GitHub Actions workflow at `.github/workflows/deploy-eb.yml` builds & deploys the backend on push to `main` using the EB CLI.

### First-Time Manual Setup (if environment not yet created)
```powershell
cd backend
pip install awsebcli
# Initialize (choose Docker platform)
eb init studentpilot-backend --platform Docker --region ap-south-1
# Create environment (single instance)
eb create studentpilot-backend-env --single --platform Docker --cname studentpilot-backend-env
# (Optional) Set env vars
eb setenv PORT=8000 CORS_ORIGINS=https://wms-virid-six.vercel.app,http://localhost:5173 DISABLE_LINKEDIN=1
# Deploy
 eb deploy
```
Once the environment exists, pushes to main auto-deploy.

### Rollback
```powershell
cd backend
eb list
eb versions
eb deploy studentpilot-backend-env --version <label>
```

### Local Test (same Gunicorn invocation)
```powershell
cd backend
python -m venv .venv; . .venv\Scripts\Activate.ps1
pip install -r requirements.txt
set PORT=8000
python -c "import uvicorn, main; uvicorn.run(main.app, host='0.0.0.0', port=8000)"
```

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

## 🌊 Deployment on DigitalOcean (App Platform or Droplet)

### Option A: App Platform (recommended – managed build & deploy)
1. Push this repo to GitHub (make sure `.env` files are NOT committed).
2. In DigitalOcean App Platform, create a new App from the repo.
3. Components:
   - Backend: Select `backend/` directory as a Web Service (Dockerfile auto-detected). Set HTTP port to `8000` (App Platform injects `PORT`).
   - Frontend: Select root with `Dockerfile` OR use a Static Site:
     - If Static Site: build command `npm run build`, output dir `dist`.
     - Set env var `VITE_API_BASE` to the deployed backend URL.
4. Environment Variables:
   - Backend: `PORT=8000`, optional `DISABLE_LINKEDIN=1` (saves memory / avoids Selenium if Chromium not needed), any API keys.
   - Frontend: `VITE_API_BASE=https://<backend-domain>`.
5. Scale: Start with Basic 1 vCPU / 1GB for backend (Selenium + Chromium may need 2GB). If using `DISABLE_LINKEDIN=1`, 1GB is fine.
6. Deploy – health check hits `/health`.

### Option B: Droplet (manual Docker Compose)
```bash
# On a fresh Ubuntu 22.04 droplet
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Re-log then:
 git clone https://github.com/your-user/StudentPilot.git
 cd StudentPilot
 # Create env files
 cp backend/.env.example backend/.env
 echo "DISABLE_LINKEDIN=1" >> backend/.env
 # Build & run
 docker compose up -d --build
 # Backend: :8011, Frontend: :5173 (adjust security group / firewall)
```

### Disabling LinkedIn Scraper
If you face memory/time issues or do not need LinkedIn data initially, set `DISABLE_LINKEDIN=1` (added in `backend/main.py` and passed through Docker). This skips Selenium & Chromium usage.

### Production Hardening Checklist
- Add a CDN (DigitalOcean CDN or Cloudflare) in front of the static frontend.
- Enable HTTPS (App Platform auto TLS; for Droplet use Caddy/Traefik or nginx + certbot).
- Set `WORKERS` / `TIMEOUT` env vars for Gunicorn tuning (default config in `gunicorn_conf.py`).
- Add log forwarding (App Platform built-in; Droplet use `docker logs` or a sidecar like Vector).
- Configure alerts (monitor 5xx rate & CPU > 85%).

## 🚈 Deployment on Railway

Railway can auto-detect the backend as a Docker service and frontend as a static build.

Backend (FastAPI + Gunicorn):
1. New Project -> Deploy from GitHub repo.
2. Select the repository; Railway finds `backend/Dockerfile` if you create a separate service pointing to that path.
3. Service Settings:
   - Build Args (optional): `INSTALL_CHROME=0` (saves ~300MB) if you disable LinkedIn scraping.
   - Env Vars: `PORT=8000` (Railway also injects PORT), `DISABLE_LINKEDIN=1`, other API keys.
   - Start Command: leave empty (Docker CMD handles it).
4. Exposed Port: Railway auto maps internal $PORT to public URL.
5. Health Check Path: `/health`.

Frontend (Static):
Option A (Railway Static):
- Add service -> Static Site -> Root path.
- Build Command: `npm run build`.
- Output Directory: `dist`.
- Env Vars: `VITE_API_BASE=https://<backend-domain>`.

Option B (Second Docker service):
- Use root `Dockerfile` that builds and serves via Nginx (resulting container ~ small). Keep environment var `VITE_API_BASE` build-time (ARG+--build-arg) OR runtime by rewriting config (simpler: Static Site).

Memory/Cost Tips:
- If Chromium not required: set `DISABLE_LINKEDIN=1` + build arg `INSTALL_CHROME=0` -> reduces image size + RAM usage.
- Gunicorn workers: start with `WORKERS=2` on 512MB; increase if CPU bound and memory allows.
- Add `LOG_LEVEL=warning` to reduce log volume.

Example Railway Env (Backend):
```
PORT=8000
DISABLE_LINKEDIN=1
WORKERS=2
TIMEOUT=120
OPENROUTER_API_KEY=...
GOOGLE_API_KEY=...
```

Redeploy with new build args via Railway UI when toggling Chromium.
