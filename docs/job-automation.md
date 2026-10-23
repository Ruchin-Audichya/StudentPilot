# Internship search and application workspace

StudentPilot's `/dashboard` is the search entry point. It combines the existing FastAPI internship scrapers with a local job service that searches Naukri, LinkedIn, Instahyre, Cutshort, Hirist, Indeed India, Foundit, Shine, TimesJobs, Glassdoor, Wellfound and We Work Remotely, plus selected company career domains. Each source reports its count, rejected links and errors. Search results are inspected before they enter the application queue; an empty search stays empty. The FastAPI sample fallback is disabled unless `ALLOW_SAMPLE_FALLBACK=1` is set explicitly for a demo.

The `/jobs` workspace stores the queue locally by Firebase user ID, opens a visible browser for job-site sign-in, generates a LaTeX resume from an uploaded PDF, and compiles a tailored PDF for each job. A PDF cannot reveal its original LaTeX source, so the layout is reconstructed and may need edits. Every tailored PDF must be reviewed in the workspace before application. The browser fills only known answers; it stops for login, CAPTCHA, consent, uncertain questions and unsupported forms. It records a submission only after an employer-page receipt. An ambiguous submission is never retried automatically.

The provided n8n JSON is a demonstration, not a working job-platform integration. Its LinkedIn and Indeed API URLs are placeholders, and its status checker randomly assigns outcomes. StudentPilot uses the employer page and receipts instead. The tracker can be exported as CSV using the workflow's spreadsheet columns; Google Sheets and Gmail are not required to apply.

## Local setup

1. Install dependencies with `npm ci`. Configure the existing FastAPI backend as described in the root README.
2. Copy `.env.example` to `.env` and configure `VITE_FIREBASE_*` values for the frontend. In `FIREBASE_PROJECT_ID`, use the same Firebase project for the local job service. For a one-machine trial without Firebase, set `JOB_AUTH_MODE=local`; the service prints a token that can be entered in `/jobs`.
3. Set `BRAVE_SEARCH_API_KEY` to enable the 12-board search. Set `OPENAI_API_KEY` and `OPENAI_MODEL` to enable PDF-to-LaTeX tailoring. These are server-side values and must not use the `VITE_` prefix.
4. Run `npm run jobs:compiler` to build the isolated LaTeX image. Install a Chromium browser with `npx playwright install chromium`, or set `APPLICATION_BROWSER_EXECUTABLE` to an installed Chrome path. Set `ENABLE_APPLICATION_BROWSER=true` to enable account sign-in and application filling.
5. Start `npm run jobs:server`, `npm run dev`, and the FastAPI backend in separate terminals. Vite proxies `/api/jobs` to the local job service. If using the hosted frontend, configure `VITE_JOBS_API_BASE` at build time and allow its origin in `JOB_ALLOWED_ORIGINS`; the browser service must still run on the user's own computer for visible sign-in and application forms.

Application state, uploaded PDFs and browser sessions are stored in `JOB_DATA_DIR` (default `.studentpilot/jobs`), outside Git. The local service listens on `127.0.0.1:8787` by default. Do not expose it to the public internet. A hosted frontend does not grant a remote server access to the user's job-site browser sessions.

## Daily use

1. Search in `/dashboard`, or search boards and company domains in `/jobs`.
2. In `/jobs`, open the account sessions you need and sign in in the visible browser. “Browser opened” means a window was opened; it does not assert that the site accepted your login.
3. Save your application details, upload your PDF resume, and prepare the queue. Inspect each tailored PDF and approve it.
4. Start auto-apply for reviewed jobs. The run stops at the first form that needs input or has an uncertain outcome. Continue in the browser and resume that application; never treat an HTTP response alone as proof of application.
5. Export the tracker CSV when you want a spreadsheet copy. The local state remains the source of truth for receipts and review decisions.

## Checks

Run `npm run typecheck`, `npm run test:jobs`, and `npm run build`. Real search and PDF tailoring also require the keys above and an actual uploaded resume; automated tests use mocked providers and forms.
