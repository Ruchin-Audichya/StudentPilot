<div align="center">

# Where’s My Stipend 💸

Your smart internship matcher: upload your resume, set what you care about, and instantly see paid internships ranked by real skill fit – not buzzwords.

![Hero](./src/assets/hero-nexus.jpg)

</div>

## Why We Built It
Hunting for a good internship is noisy, biased toward unpaid roles, and wastes time. Students scroll; opportunities slip away. We flip the model: you give us your profile and goals – we surface what actually fits and highlight why.

## What You Can Do (In Plain English)
1. Upload your resume – we extract your skills & roles automatically.
2. Tell us your preferences (domains, stipend expectations, location, mode).
3. Get a live feed of fresh internships (Internshala + more sources expanding).
4. See clear match scores with Hot / New tags so you act fast.
5. Ask the built‑in career bot for quick improvement tips and profile gaps.

## Core Features
✅ Resume parsing (PDF / DOCX / TXT) → auto skill & role detection
✅ Multi‑source scraping (Internshala today; more coming) with de‑duplication
✅ Smart match score (skill coverage, title similarity, stipend, recency)
✅ Hot / New tagging & relevance ordering
✅ Resume‑aware chat assistant (optional AI) for feedback & suggestions
✅ Skill gap hints so you know what to learn next
✅ Simple, responsive dashboard built for speed

## Tech Stack (Lean Overview)
Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui
Backend: FastAPI (Python) + Requests + BeautifulSoup + optional Selenium
Matching & Parsing: PyMuPDF, python-docx, rapidfuzz heuristics
AI (optional): OpenRouter (multi‑model) / Gemini fallback
Infra & Delivery: Docker, AWS Elastic Beanstalk (API), Vercel (frontend proxy)
Auth / Data (optional mode): Firebase

## Quick Start
Clone & install:
```powershell
git clone https://github.com/Ruchin-Audichya/StudentPilot.git
cd StudentPilot
npm install
cd backend
python -m venv .venv; . .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Run backend:
```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Run frontend (new terminal at project root):
```powershell
npm run dev
```

Open: http://localhost:5173

Upload a resume (dummy PDF works) → watch skills populate → search internships.

### One-Click Deploy Trigger (CI)
Run the PowerShell helper to force a backend deploy via GitHub Actions:
`pwsh scripts/trigger-deploy.ps1 -Message "ci: redeploy"`

### Manual Smoke Test (direct EB origin)
After a deploy, run (Linux/macOS WSL):
`bash backend/scripts/smoke.sh https://<your-eb-cname>`
Outputs health JSON & a truncated search response.

## Environment (Minimal Essentials)
Frontend: `VITE_API_BASE` (leave blank in prod – it auto uses the proxy)
Backend (optional): `OPENROUTER_API_KEY`, `DISABLE_LINKEDIN=1` (to skip heavy scraping)

We intentionally keep secrets out of the repo. Use your hosting provider’s dashboard to add them.

## Deployment Snapshot
Backend lives on AWS Elastic Beanstalk (Docker). Frontend is on Vercel and proxies API calls to the EB URL transparently via `/api/backend/*`. Health checks live at `/health`.

## Roadmap
- Add more sources (LinkedIn refined, AngelList, company pages)
- Email / WhatsApp alerts for new high‑fit roles
- Deeper semantic matching (embeddings)
- Career trajectory suggestions & learning pathways
- Application tracking & success analytics
- Gamified streaks + profile strength score

## Screens (Preview)
Landing • Dashboard • Onboarding • Match Scores (Add your own screenshots under `docs/screenshots/` to display here.)

## Contributing
Have an idea or want to plug in a new source? PRs welcome.
1. Fork + branch
2. Keep changes focused
3. Add a short description / screenshot
4. Open PR – we review fast

## Credits
Built with care by:
Ruchin Audichya – Engineering & UX
Shriya Gakkhar – Product, UX & QA

If this helps you land something great, drop a star ⭐ and share it with friends.

## License
Open for learning & experimentation. Feel free to adapt – add a formal license file (MIT recommended) if you fork for production.

---
Internship search should feel empowering, not exhausting. This is our small step toward that future.
