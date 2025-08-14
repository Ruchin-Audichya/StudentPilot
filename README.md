## Quick start

This repo is a full-stack app:
- Frontend: React + Vite (TypeScript, Tailwind/shadcn)
- Backend: FastAPI (Python) with AI via OpenRouter or Gemini

### 1) Prerequisites
- Node.js 18+ and npm
- Python 3.11+

### 2) Clone
```bash
git clone https://github.com/Ruchin-Audichya/StudentPilot.git
cd StudentPilot
```

### 3) Env vars (do not commit secrets)
- Copy `.env.example` to `.env.local` (frontend) and `backend/.env.example` to `backend/.env` (backend) and set values.

Frontend `.env.local`:
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

Backend `backend/.env`:
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

The backend auto-loads env from both repo root and `backend/`.

### 4) Install & run
Backend:
```powershell
cd backend
python -m venv .venv; . .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8011
```

Frontend (in another terminal):
```powershell
npm install
npm run dev
```

- App: http://127.0.0.1:5173 (Vite)
- API: http://127.0.0.1:8011
<div align="center">

# Where's My Stipend

Find internships that actually match your skills. Upload your resume, search with your interests, and chat with an AI career copilot — all in a sleek glassmorphism UI.

<br/>

![Hero](./src/assets/hero-nexus.jpg)

</div>

## ✨ Features

- Resume-aware search: upload a PDF/DOCX/TXT and we extract key skills automatically.
- Internship finder powered by Internshala scraping with graceful fallbacks.
- B.Tech buzzwords CSV to bias searches toward relevant student roles (editable).
- Career chatbot via OpenRouter first (multi-model fallback), with Gemini Flash fallback.
- Modern UI: Tailwind + shadcn-ui + glassmorphism, rounded, responsive.

## 🧭 Architecture

- Frontend: React + Vite + TypeScript + Tailwind/shadcn.
- Backend: FastAPI + Uvicorn, simple scraping + keyword extraction.
- AI: OpenRouter HTTP API (preferred) and Google Gemini via google-generativeai (fallback).

```
src/                 # React app (UI, services)
backend/             # FastAPI server
	scrapers/          # Internshala scraper
	data/btech_buzzwords.csv  # CSV of B.Tech job buzzwords
```

## �️ Scripts
You can add tasks.json or use these commands above. For production builds:
```powershell
# Frontend build
npm run build; npm run preview

# Backend (prod)
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Optional: Enable Firebase (email/password signup + Storage)

1) In `.env` set:

```
VITE_FIREBASE_ENABLED=true
VITE_FIREBASE_API_KEY=... 
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_APP_ID=...
```

2) Restart `npm run dev`.

- On Onboarding, you'll see Email + Password fields. Submitting will create/sign-in a Firebase Auth user and store the profile in Firestore at `users/{uid}`. If Firebase isn't configured, onboarding still works locally (saved to localStorage) and the app continues.

## 🔌 API quick reference

POST /api/upload-resume
- Body: multipart/form-data, field file(.pdf/.docx/.txt)
- Use: sets resume context for search/chat

POST /api/search
- Body: { query: string, filters: { location?: string, experience_level?: string } }
- Behavior: Uses query first; if empty/no results, falls back to resume keywords (incl. B.Tech buzzwords)

POST /api/chat
- Body: { message: string }
- Returns concise, actionable answers using Gemini with your resume as context

## 🧠 B.Tech buzzwords

CSV: `backend/data/btech_buzzwords.csv`
- Format: `Job_Title,Required_Skills`
- You can edit or replace this file to tune search weightings for student roles.

## 🖌️ UI notes

- Glass cards via `.glass-card` class in `src/index.css`.
- Rounded, gradient buttons: `gradient-primary`, `gradient-success`, etc.

## 🤝 Contributors

- Ruchin Audichya — Dev , UI/UX 
- Shriya Gakkhar — Idea, UI/UX and product shaping, bugs fixing
	- GitHub: https://github.com/shriya-gakkhar1

If you find this useful, star the repo and share feedback!

## 🔐 Security

Do not commit secrets. `.env` is git-ignored. Use `.env.example` as a guide.

## 📄 License

This project is provided as-is for learning and prototyping. Choose a license when you’re ready to open-source or distribute.

---

## What changed recently

- New Landing page at `/` with responsive navbar; buttons navigate to `/onboarding` via SPA.
- Routing updated in `src/App.tsx`; previous index flow kept inside `src/pages/Index.tsx` (exported as OldIndex in code).
- ResumeUploader enhanced: optional Firebase Storage upload (anonymous auth) while still sending file to backend for parsing.
- Onboarding updated: when Firebase is enabled, supports email/password signup and saves profile to Firestore. Falls back to local-only if disabled.
- Backend: OpenRouter-first with multi-model retry/backoff, Gemini flash fallback, optional Firebase Admin and LinkedIn scraper via env flags.
- LinkedIn scraper dependencies added (selenium, webdriver-manager); Internshala remains default.
- Buzzwords CSV loaded at startup; search falls back to resume keywords.
