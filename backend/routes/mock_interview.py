import os
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import requests

router = APIRouter(prefix="/api/mock-interview", tags=["mock-interview"])


class StartRequest(BaseModel):
    focus: Optional[str] = None  # e.g., "java", "c++", "dsa"
    count: int = 6


class FollowupRequest(BaseModel):
    last_question: str
    user_answer: str
    transcript: Optional[List[Dict[str, str]]] = None  # list of {q,a}


def _openrouter_config():
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    models = [m.strip() for m in os.getenv("OPENROUTER_MODELS", "deepseek/deepseek-chat:free").split(",") if m.strip()]
    base = os.getenv("OPENROUTER_BASE", "https://openrouter.ai/api/v1/chat/completions").strip()
    site_url = os.getenv("OPENROUTER_SITE_URL", os.getenv("FRONTEND_ORIGIN", "https://studentpilot.onrender.com")).strip()
    site_name = os.getenv("OPENROUTER_SITE_NAME", "StudentPilot").strip() or "StudentPilot"
    return key, models, base, site_url, site_name


def _session_resume(request: Request):
    try:
        from main import _get_session_id, _get_session_profile  # type: ignore
        sid = _get_session_id(request)
        text, profile = _get_session_profile(sid)
        return sid, (text or ""), profile or {"skills": set(), "roles": set(), "location": None}
    except Exception:
        return None, "", {"skills": set(), "roles": set(), "location": None}


def _llm_json(prompt: str, model_hint: Optional[str] = None) -> Optional[Dict[str, Any]]:
    key, models, base, site_url, site_name = _openrouter_config()
    if model_hint and model_hint not in models:
        models = [model_hint] + models
    if not key:
        return None
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": site_url,
        "X-Title": site_name,
    }
    for m in models:
        try:
            r = requests.post(base, headers=headers, json={
                "model": m,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "Return strict JSON only with the requested keys. No preface."},
                    {"role": "user", "content": prompt},
                ],
            }, timeout=20)
            if r.ok:
                data = r.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
                import json as _json
                return _json.loads(content)
        except Exception:
            continue
    return None


@router.post("/start")
async def start_interview(req: StartRequest, request: Request):
    sid, resume_text, profile = _session_resume(request)
    skills = ", ".join(sorted(list(profile.get("skills", []))))
    roles = ", ".join(sorted(list(profile.get("roles", []))))
    focus = (req.focus or "").strip().lower()
    count = max(3, min(6, req.count or 6))

    # Prompt LLM for 5-6 simple, answerable questions based on resume and preferred focus
    prompt = f"""
You are an HR/technical interviewer. Create a short list of {count} mock interview questions tailored to the candidate's resume.
Constraints:
- Keep questions simple and answerable by students (no trick puzzles).
- Mix: 2 behavioral, rest technical aligned to resume.
- If resume hints at {focus or 'java/c++/dsa'}, include basic {focus or 'DSA and language'} fundamentals.
- Prefer normal, common interview questions.
Input resume text (may be empty):\n{resume_text[:4000]}
Resume skills: {skills}
Resume roles: {roles}
Return JSON: {{ "questions": ["q1","q2", ...] }} only.
"""

    resp = _llm_json(prompt, model_hint=None)
    questions: List[str] = []
    if resp and isinstance(resp.get("questions"), list):
        questions = [str(q).strip() for q in resp["questions"] if str(q).strip()]
    # Fallback preset if LLM unavailable
    if not questions:
        base = [
            "Tell me about a project on your resume you enjoyed.",
            "Explain time complexity of a common data structure you used recently.",
            "In Java or C++, how would you manage memory or avoid leaks?",
            "Walk me through solving a simple array problem (e.g., find max).",
            "How do you handle feedback and collaborate in a team?",
        ]
        if count > len(base):
            base.append("What is the difference between a stack and a queue, and where would you use each?")
        questions = base[:count]

    return {"session_id": sid, "questions": questions}


@router.post("/followup")
async def followup(req: FollowupRequest, request: Request):
    sid, resume_text, profile = _session_resume(request)
    skills = ", ".join(sorted(list(profile.get("skills", []))))
    roles = ", ".join(sorted(list(profile.get("roles", []))))

    transcript_text = "\n".join([f"Q: {t.get('q','')}\nA: {t.get('a','')}" for t in (req.transcript or [])])
    prompt = f"""
You are an interviewer continuing a mock interview. Based on the candidate's resume and their last answer, generate ONE next smart question.
Guidelines:
- Use the resume themes and skills when relevant.
- Keep it normal and practical (no trick puzzles).
- Keep it short (1–2 sentences).
- If last answer was weak or vague, probe a bit deeper politely.
Return JSON: {{ "next_question": "..." }} only.

Resume (may be empty):\n{resume_text[:2000]}
Skills: {skills}\nRoles: {roles}
Previous Q/A transcript (may be empty):\n{transcript_text}
Last Q: {req.last_question}\nUser A: {req.user_answer}
"""
    resp = _llm_json(prompt, model_hint=None)
    next_q = None
    if resp:
        next_q = (resp.get("next_question") or "").strip()
    if not next_q:
        next_q = "Could you expand on a specific challenge from your resume and how you handled it?"
    return {"session_id": sid, "next_question": next_q}
