from __future__ import annotations

import io
import zipfile
from typing import Any, Dict, List, Optional
import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class ResumeModel(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    links: Optional[List[Dict[str, str]]] = None  # [{label,url}]
    skills: Optional[List[str]] = None
    projects: Optional[List[Dict[str, Any]]] = None  # [{title, description, link, tech}]
    experience: Optional[List[Dict[str, Any]]] = None  # [{company, role, period, description}]
    education: Optional[List[Dict[str, Any]]] = None  # [{school, degree, period}]


class PortfolioRequest(BaseModel):
    resume: Optional[ResumeModel] = None
    theme: Optional[str] = None  # reserved for future (light/dark)
    include_vercel: bool = True
    ai: Optional[bool] = True  # when True and Gemini is configured, enrich content
    model: Optional[str] = None  # optional Gemini model override
    full_site_ai: Optional[bool] = False  # when True, ask Gemini to output complete site HTML/CSS


def _html_escape(x: Optional[str]) -> str:
    import html
    return html.escape((x or "").strip())


def _build_site(resume: Dict[str, Any], include_vercel: bool = True, enriched: Optional[Dict[str, Any]] = None) -> bytes:
    name = _html_escape(resume.get("name") or "Your Name")
    # Prefer AI-enriched about/summary when provided
    enriched_about = (enriched or {}).get("about") if isinstance(enriched, dict) else None
    summary = _html_escape(enriched_about or resume.get("summary") or "")
    email = _html_escape(resume.get("email") or "")
    phone = _html_escape(resume.get("phone") or "")
    location = _html_escape(resume.get("location") or "")
    skills = (enriched.get("skills") if isinstance(enriched, dict) and enriched.get("skills") else resume.get("skills")) or []
    links = resume.get("links") or []
    projects = (enriched.get("projects") if isinstance(enriched, dict) and enriched.get("projects") else resume.get("projects")) or []
    experience = (enriched.get("experience") if isinstance(enriched, dict) and enriched.get("experience") else resume.get("experience")) or []
    education = resume.get("education") or []

    # Compute link anchors
    def _link_tags(ls: List[Dict[str, str]]) -> str:
        if not ls:
            return ""
        return '<div class="links">' + ''.join([f'<a href="{_html_escape(l.get("url"))}" target="_blank">{_html_escape(l.get("label") or l.get("url"))}</a>' for l in ls]) + '</div>'

    # Project/experience rendering accommodating enriched fields
    def _render_projects(ps: List[Dict[str, Any]]) -> str:
        if not ps:
            return ""
        parts = []
        for p in ps:
            title = _html_escape(p.get("title") or p.get("name") or "Project")
            tagline = _html_escape(p.get("tagline") or "")
            desc = _html_escape(p.get("description") or "")
            link = _html_escape(p.get("link") or p.get("url") or "")
            tech = p.get("tech") or p.get("technologies") or []
            tech_html = ''
            if tech:
                chips = ''.join([f'<li>{_html_escape(str(t))}</li>' for t in tech[:10]])
                tech_html = f'<ul class="tags">{chips}</ul>'
            link_html = f'<p class="muted"><a href="{link}" target="_blank">View project</a></p>' if link else ''
            parts.append(f'<article class="card"><h3>{title}</h3>' + (f'<p class="muted">{tagline}</p>' if tagline else '') + (f'<p>{desc}</p>' if desc else '') + tech_html + link_html + '</article>')
        return '<section id="projects"><h2>Projects</h2>' + ''.join(parts) + '</section>'

    def _render_experience(xs: List[Dict[str, Any]]) -> str:
        if not xs:
            return ""
        parts = []
        for x in xs:
            role = _html_escape(x.get("role") or x.get("title") or "Intern")
            company = _html_escape(x.get("company") or "")
            period = _html_escape(x.get("period") or x.get("dates") or "")
            desc = _html_escape(x.get("description") or "")
            highlights = x.get("highlights") or []
            body = ''
            if highlights:
                lis = ''.join([f'<li>{_html_escape(str(h))}</li>' for h in highlights[:6]])
                body = f'<ul class="bullets">{lis}</ul>'
            elif desc:
                body = f'<p>{desc}</p>'
            parts.append(f'<article class="card"><h3>{role} – {company}</h3>' + (f'<div class="period">{period}</div>' if period else '') + body + '</article>')
        return '<section id="experience"><h2>Experience</h2>' + ''.join(parts) + '</section>'

    def _render_education(es: List[Dict[str, Any]]) -> str:
        if not es:
            return ""
        parts = []
        for e in es:
            degree = _html_escape(e.get("degree") or e.get("title") or "B.Tech")
            school = _html_escape(e.get("school") or e.get("institution") or "")
            period = _html_escape(e.get("period") or e.get("dates") or "")
            parts.append(f'<article class="card"><h3>{degree} – {school}</h3>' + (f'<div class="period">{period}</div>' if period else '') + '</article>')
        return '<section id="education"><h2>Education</h2>' + ''.join(parts) + '</section>'

    # Determine resume download link from links (common labels) and LinkedIn profile link
    resume_link = ""
    linkedin_link = "https://www.linkedin.com"
    for l in links:
        label = (l.get("label") or "").lower()
        url = _html_escape(l.get("url") or "")
        if not resume_link and ("resume" in label or "cv" in label):
            resume_link = url
        if "linkedin" in label and url:
            linkedin_link = url

    index_html = f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\"> <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>{name} – Portfolio</title>
  <link rel=\"stylesheet\" href=\"styles.css\">
</head>
<body>
  <main class=\"container\">
    <header class=\"hero\">
      <div class=\"hero-bg\"></div>
      <div class=\"hero-inner\">
        <h1>{name}</h1>
        <div class=\"meta\">{location}{' • ' if location and (email or phone) else ''}{email}{' • ' if email and phone else ''}{phone}</div>
                {f'<p class=\"summary\">{summary}</p>' if summary else ''}
                <div class=\"cta\"> 
                    {f'<a class=\"btn primary\" href=\"{_html_escape(linkedin_link)}\" target=\"_blank\">Connect on LinkedIn</a>'}
                    {f'<a class=\"btn\" href=\"mailto:{email}\">Email Me</a>' if email else ''}
                    {f'<a class=\"btn\" href=\"{resume_link}\" target=\"_blank\">Download Resume</a>' if resume_link else ''}
                </div>
                {_link_tags(links)}
      </div>
    </header>

    {('<section id=\"skills\"><h2>Skills</h2><ul class=\"tags\">' + ''.join([f'<li>{_html_escape(s)}</li>' for s in skills]) + '</ul></section>') if skills else ''}

    {_render_projects(projects)}

    {_render_experience(experience)}

    {_render_education(education)}

    <footer>Built with ❤️ by StudentPilot</footer>
  </main>
</body>
</html>"""

    styles_css = """
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif;background:radial-gradient(1200px 600px at 10% -10%,#14233b,#0b0f17 40%);color:#e6edf3}
.container{max-width:980px;margin:0 auto;padding:32px}
.hero{position:relative;border:1px solid rgba(255,255,255,.08);background:linear-gradient(135deg,rgba(131,201,255,.06),rgba(255,255,255,.02));padding:26px;border-radius:16px;overflow:hidden;margin-bottom:24px}
.hero-bg{position:absolute;inset:-20px;background:radial-gradient(600px 200px at 0% 0%,rgba(131,201,255,.08),transparent),radial-gradient(400px 200px at 100% -10%,rgba(255,163,163,.10),transparent);filter:blur(6px);animation:pulse 6s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:.9;transform:scale(1.02)}}
.hero-inner{position:relative}
h1{margin:0 0 6px 0;font-size:32px}
.meta{opacity:.8;font-size:14px;margin-bottom:8px}
.summary{opacity:.95;max-width:70ch}
.cta{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
.btn{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);color:#e6edf3;text-decoration:none;transition:.2s ease}
.btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.08)}
.btn.primary{border-color:rgba(131,201,255,.35);background:rgba(131,201,255,.10);color:#bfe6ff}
.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
.links a{color:#83c9ff;text-decoration:none;border:1px solid rgba(131,201,255,.25);padding:6px 10px;border-radius:999px;background:rgba(131,201,255,.05)}
.links a:hover{background:rgba(131,201,255,.10)}
h2{font-size:20px;margin:26px 0 12px 0}
section{margin-bottom:16px}
.tags{list-style:none;display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:0}
.tags li{font-size:12px;border:1px solid rgba(255,255,255,.15);padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.04)}
.card{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.03);padding:14px 16px;border-radius:12px;margin-bottom:12px;transition:.2s ease}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(0,0,0,.25)}
.card h3{margin:0 0 6px 0;font-size:16px}
.muted{opacity:.9}
.period{opacity:.7;font-size:12px;margin-bottom:4px}
.bullets{margin:8px 0 0 18px}
.bullets li{margin:4px 0}
footer{opacity:.6;font-size:12px;margin-top:26px}
"""

    readme_md = f"""# {name} – Portfolio

This is a simple static portfolio site generated from your resume.

## Deploy

- GitHub Pages: push these files to a new repo, then enable Pages in Settings.
- Vercel: import the repo; framework = Other, output = root.

"""

    vercel_json = """{
  "rewrites": [{ "source": "(.*)", "destination": "/index.html" }]
}
"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("index.html", index_html)
        z.writestr("styles.css", styles_css)
        z.writestr("README.md", readme_md)
        if include_vercel:
            z.writestr("vercel.json", vercel_json)
    buf.seek(0)
    return buf.read()


def _enrich_with_ai(resume: Dict[str, Any], model: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Use backend Gemini proxy (if configured) to enrich resume into nicer portfolio sections.

    Returns a dict like:
      {
        about: str,
        skills: [str],
        projects: [{title, tagline?, description?, link?, tech?: [str]}],
        experience: [{company, role, period?, highlights?: [str]}]
      }
    or None on failure.
    """
    try:
        from main import _gemini_generate_content, GOOGLE_API_KEY  # type: ignore
    except Exception:
        return None
    if not GOOGLE_API_KEY:
        return None
    # Build compact JSON-oriented prompt
    rj = resume.copy()
    # Avoid huge payloads
    if isinstance(rj.get("projects"), list):
        rj["projects"] = rj["projects"][:6]
    if isinstance(rj.get("experience"), list):
        rj["experience"] = rj["experience"][:6]
    prompt = (
        "You are creating a clean static portfolio. Transform the following resume JSON into an improved JSON\n"
        "with fields: about (2–3 sentences), skills (top 12),\n"
        "projects (up to 6) each with {title, optional tagline, description (1–2 lines), link if exists, tech list},\n"
        "experience (up to 5) each with {company, role, period if known, 3–5 bullet highlights},\n"
        "education may be omitted. Return ONLY minified JSON, no commentary.\n\n"
        f"Resume JSON:\n{json.dumps(rj, ensure_ascii=False)}\n"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.5, "maxOutputTokens": 600}
    }
    try:
        raw = _gemini_generate_content(model or "gemini-2.5-flash", payload)
        # Extract first text candidate
        text = None
        try:
            cands = (raw or {}).get("candidates") or []
            if cands:
                parts = (((cands[0] or {}).get("content") or {}).get("parts")) or []
                texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
                text = ("\n".join(texts)).strip() if texts else None
        except Exception:
            text = None
        if not text:
            return None
        # Strip code fences if present
        if "```" in text:
            try:
                fenced = text.split("```", 2)
                # If language hint present like ```json
                if len(fenced) >= 2:
                    inner = fenced[1]
                    if inner.strip().lower().startswith("json") and len(fenced) >= 3:
                        text = fenced[2]
                    else:
                        text = inner
            except Exception:
                pass
        # Attempt to locate JSON object
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start:end+1]
        data = json.loads(text)
        # Basic sanity normalization
        if isinstance(data, dict):
            # Ensure lists
            for k in ("skills", "projects", "experience"):
                if k in data and not isinstance(data[k], list):
                    data[k] = [data[k]] if data[k] else []
            return data
        return None
    except Exception:
        return None


def _ai_generate_full_site(resume: Dict[str, Any], model: Optional[str] = None) -> Optional[Dict[str, str]]:
    """Ask Gemini (via backend proxy) to produce a minimal but complete portfolio site.

    Expected JSON response shape (strict):
      { "index_html": "...", "styles_css": "..." }
    Returns None on failure.
    """
    try:
        from main import _gemini_generate_content, GOOGLE_API_KEY  # type: ignore
    except Exception:
        return None
    if not GOOGLE_API_KEY:
        return None
    # Trim resume payload size
    rj = resume.copy()
    if isinstance(rj.get("projects"), list):
        rj["projects"] = rj["projects"][:6]
    if isinstance(rj.get("experience"), list):
        rj["experience"] = rj["experience"][:6]
    prompt = (
        "You are a web generator. Create a simple, responsive, single-file portfolio website from the provided resume JSON.\n"
        "Return ONLY a minified JSON object with exactly two string keys: index_html and styles_css. No markdown, no comments.\n"
        "index_html: a valid HTML5 document that references styles.css via <link rel=\"stylesheet\" href=\"styles.css\">.\n"
        "The site must include: name, summary/about, contact (email/links), skills (tags), projects (cards), experience, education.\n"
        "Choose a clean modern style. Avoid external fonts/assets. Keep inline JS minimal or none.\n\n"
        f"Resume JSON:\n{json.dumps(rj, ensure_ascii=False)}\n"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2500}
    }
    try:
        raw = _gemini_generate_content(model or "gemini-2.5-pro-exp-02-05", payload)
        text = None
        try:
            cands = (raw or {}).get("candidates") or []
            if cands:
                parts = (((cands[0] or {}).get("content") or {}).get("parts")) or []
                texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
                text = ("\n".join(texts)).strip() if texts else None
        except Exception:
            text = None
        if not text:
            return None
        # Strip code fences if present
        if "```" in text:
            try:
                fenced = text.split("```", 2)
                if len(fenced) >= 2:
                    inner = fenced[1]
                    if inner.strip().lower().startswith("json") and len(fenced) >= 3:
                        text = fenced[2]
                    else:
                        text = inner
            except Exception:
                pass
        # Extract JSON
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        data = json.loads(text[start:end+1])
        if not isinstance(data, dict):
            return None
        ih = data.get("index_html")
        sc = data.get("styles_css")
        if isinstance(ih, str) and isinstance(sc, str) and "</html>" in ih.lower():
            return {"index_html": ih, "styles_css": sc}
        return None
    except Exception:
        return None


@router.post("/generate")
def generate_portfolio(req: PortfolioRequest, request: Request):
    resume = req.resume.model_dump() if req.resume else None
    # Session fallback if resume payload missing
    if not resume:
        try:
            from main import _get_session_id, _get_session_profile  # type: ignore
            sid = _get_session_id(request)
            text, profile = _get_session_profile(sid)
            resume = {
                "name": profile.get("name") or "Student",
                "summary": (text or "").split("\n\n")[0][:300],
                "skills": sorted(list(profile.get("skills", [])))[:25],
                "location": profile.get("location") or "",
                "projects": [],
                "experience": [],
                "education": [],
            }
        except Exception:
            resume = {"name": "Student", "skills": []}

    try:
        # Optional: full-site generation via Gemini
        if req.full_site_ai:
            ai_site = _ai_generate_full_site(resume or {}, model=(req.model or None))
            if ai_site and isinstance(ai_site.get("index_html"), str) and isinstance(ai_site.get("styles_css"), str):
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
                    z.writestr("index.html", ai_site["index_html"])
                    z.writestr("styles.css", ai_site["styles_css"])
                    if req.include_vercel:
                        z.writestr("vercel.json", "{\n  \"rewrites\": [{ \"source\": \"(.*)\", \"destination\": \"/index.html\" }]\n}\n")
                buf.seek(0)
                data = buf.read()
            else:
                # Fallback to templated builder
                enriched = _enrich_with_ai(resume or {}, model=(req.model or None)) if req.ai else None
                data = _build_site(resume or {}, include_vercel=req.include_vercel, enriched=enriched)
        else:
            # Legacy path: template with optional enrichment
            enriched = _enrich_with_ai(resume or {}, model=(req.model or None)) if req.ai else None
            data = _build_site(resume or {}, include_vercel=req.include_vercel, enriched=enriched)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate: {e}")

    headers = {
        "Content-Disposition": "attachment; filename=portfolio.zip"
    }
    return StreamingResponse(io.BytesIO(data), media_type="application/zip", headers=headers)
