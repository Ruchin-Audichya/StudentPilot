from __future__ import annotations

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

try:
    from utils.resume_analyzer import analyze_resume_vs_jobs
except Exception as e:  # pragma: no cover
    analyze_resume_vs_jobs = None  # type: ignore
    _IMPORT_ERR = e
else:
    _IMPORT_ERR = None


router = APIRouter(prefix="/api/analyze", tags=["resume-analyzer"])


class AnalyzeJobModel(BaseModel):
    title: str
    description: str
    company: Optional[str] = None
    tags: Optional[List[str]] = None
    url: Optional[str] = None


class AnalyzeRequest(BaseModel):
    resume_text: Optional[str] = Field(None, description="Raw text of the resume; falls back to session if missing")
    resume_skills: Optional[List[str]] = Field(None, description="Optional pre-parsed resume skills")
    jobs: List[AnalyzeJobModel]
    top_job_keywords: int = 20
    top_missing: int = 8
    use_ai: bool = Field(True, description="If true and Gemini is configured, include AI suggestions (weak points, grammar fixes)")
    ai_model: Optional[str] = Field(None, description="Override Gemini model used for AI suggestions (default: gemini-2.5-flash)")


@router.post("/resume-vs-jobs")
def analyze(req: AnalyzeRequest, request: Request) -> Dict[str, Any]:
    if _IMPORT_ERR:
        raise HTTPException(status_code=500, detail=f"analyzer unavailable: {_IMPORT_ERR}")

    text = req.resume_text or ""
    skills = req.resume_skills or []

    # Try to pull from session if not provided explicitly
    if not text or not skills:
        try:
            from main import _get_session_id, _get_session_profile  # type: ignore
            sid = _get_session_id(request)
            sess_text, profile = _get_session_profile(sid)
            if not text:
                text = sess_text
            if not skills:
                skills = sorted(list(profile.get("skills", [])))
        except Exception:
            pass

    if not text:
        raise HTTPException(status_code=400, detail="resume_text is empty and no session resume found")

    jobs = [j.model_dump() for j in req.jobs]
    result = analyze_resume_vs_jobs(text, skills, jobs, top_job_keywords=req.top_job_keywords, top_missing=req.top_missing)  # type: ignore

    # Optionally enhance with AI suggestions via Gemini if configured
    if req.use_ai:
        try:
            # Lazy import to avoid circulars on app startup
            from main import _gemini_generate_content, GOOGLE_API_KEY  # type: ignore
        except Exception:
            _gem = None
            _gkey = ""
        else:
            _gem = _gemini_generate_content
            _gkey = GOOGLE_API_KEY

        if _gem and _gkey:
            try:
                # Limit payload size for token efficiency
                top_jobs = []
                for j in jobs[:6]:
                    top_jobs.append({
                        "title": (j.get("title") or "")[:200],
                        "company": (j.get("company") or "")[:200],
                        "description": (j.get("description") or "")[:2000],
                    })

                prompt = {
                    "role": "user",
                    "parts": [{
                        "text": (
                            "You are a career assistant for Indian B.Tech students seeking internships.\n"
                            "Given the resume text and a few internship descriptions, analyze and return a concise JSON with:\n"
                            "- suggestions: 5-8 actionable, resume-specific suggestions to improve ATS chances (start with 'Add <keyword>' when it's a missing keyword).\n"
                            "- weak_points: 3-6 bullet points about gaps (skills, experience, clarity).\n"
                            "- grammar_fixes: list of objects {issue, suggestion} focusing on resume phrasing and grammar.\n"
                            "Be specific and prefer keywords common in software/CS internships. Keep each item short.\n"
                            "Return ONLY valid minified JSON object with keys: suggestions, weak_points, grammar_fixes. No extra text.\n\n"
                            f"Resume:\n{text[:6000]}\n\nJobs:\n{top_jobs}"
                        )
                    }]
                }

                model = (req.ai_model or "gemini-2.5-flash").strip()
                payload = {"contents": [prompt], "generationConfig": {"temperature": 0.3}}
                raw = _gem(model, payload)  # raw Google response JSON
                # Extract text parts and parse JSON
                ai_text: Optional[str] = None
                try:
                    cands = (raw or {}).get("candidates") or []
                    if cands:
                        parts = (((cands[0] or {}).get("content") or {}).get("parts")) or []
                        texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
                        ai_text = "\n".join(texts).strip() if texts else None
                except Exception:
                    ai_text = None

                ai_json: Optional[Dict[str, Any]] = None
                if ai_text:
                    import json
                    # Try direct parse; if fails, attempt to locate JSON substring
                    try:
                        ai_json = json.loads(ai_text)
                    except Exception:
                        try:
                            start = ai_text.find("{")
                            end = ai_text.rfind("}")
                            if start >= 0 and end > start:
                                ai_json = json.loads(ai_text[start:end+1])
                        except Exception:
                            ai_json = None

                if ai_json and isinstance(ai_json, dict):
                    result["ai"] = {
                        "model": model,
                        "suggestions": ai_json.get("suggestions") or [],
                        "weak_points": ai_json.get("weak_points") or [],
                        "grammar_fixes": ai_json.get("grammar_fixes") or [],
                    }
                else:
                    # Provide raw text when parsing fails for transparency
                    result["ai"] = {"model": model, "raw": ai_text or ""}
            except Exception as e:
                # Non-fatal; keep rule-based result
                result["ai_error"] = str(e)[:300]

    return result
