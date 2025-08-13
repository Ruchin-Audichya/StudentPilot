<div align="center">

# StudentPilot

Find internships that actually match your skills. Upload your resume, search with your interests, and chat with an AI career copilot — all in a sleek glassmorphism UI.

<br/>

![Hero](./src/assets/hero-nexus.jpg)

</div>

## ✨ Features

- Resume-aware search: upload a PDF/DOCX/TXT and we extract key skills automatically.
- Internship finder powered by Internshala scraping with graceful fallbacks.
- B.Tech buzzwords CSV to bias searches toward relevant student roles (editable).
- Career chatbot using Google Gemini (1.5 Flash) for fast, helpful answers.
- Modern UI: Tailwind + shadcn-ui + glassmorphism, rounded, responsive.

## 🧭 Architecture

- Frontend: React + Vite + TypeScript + Tailwind/shadcn.
- Backend: FastAPI + Uvicorn, simple scraping + keyword extraction.
- AI: Google Gemini via google-generativeai SDK.

```
src/                 # React app (UI, services)
backend/             # FastAPI server
	scrapers/          # Internshala scraper
	data/btech_buzzwords.csv  # CSV of B.Tech job buzzwords
```

## 🚀 Getting started

### 1) Prerequisites

- Node.js 18+ and npm
- Python 3.11+

### 2) Clone

```bash
git clone https://github.com/Ruchin-Audichya/StudentPilot.git
cd StudentPilot
```

### 3) Environment variables

Copy the example and fill in your Gemini API key:

```bash
cp .env.example .env
```

Variables
- GOOGLE_API_KEY: Google Gemini API key for chatbot.
- PORT: Backend port (default 8000).
- VITE_API_BASE: Frontend API base (default http://127.0.0.1:8000).

### 4) Install & run

Backend (FastAPI):

```bash
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
python backend/main.py
```

Frontend (Vite):

```bash
npm install
npm run dev
```

- App: http://127.0.0.1:8080
- API: http://127.0.0.1:8000

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
