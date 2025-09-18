from __future__ import annotations

from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import json

router = APIRouter(prefix="/api/mock-interview", tags=["mock-interview"])


class StartRequest(BaseModel):
    focus: Optional[str] = None  # e.g., "software", "data"
    count: Optional[int] = 5


def _default_questions() -> List[str]:
    return [
        "Introduce yourself.",
        "Why are you interested in this internship?",
        "Walk me through one project you’re proud of.",
        "What technologies are you most comfortable with?",
        "Tell me about a challenge you solved recently.",
    ]


def _gemini_questions(resume_text: str, roles: List[str], skills: List[str], count: int, focus: Optional[str]) -> Optional[List[str]]:
    try:
        from main import _gemini_generate_content, GOOGLE_API_KEY  # type: ignore
    except Exception:
        return None
    if not GOOGLE_API_KEY:
        return None
    # Build strict prompt to return JSON array of short questions
    r_text = (resume_text or "")[:3500]
    roles_l = ", ".join(roles[:6])
    skills_l = ", ".join(skills[:10])
    f = f" with a focus on {focus}" if focus else ""
    prompt = (
        "Act as a friendly internship interviewer. Based ONLY on the candidate’s resume text and hints, "
        "generate a list of short and easy technical interview questions (new‑grad level).\n"
        "Rules: First two should be ‘Introduce yourself’ and ‘Why do you want this internship?’. "
        "Then include simple tech questions tied to the resume’s roles/skills (no trick questions).\n"
        f"Return ONLY minified JSON array of {max(3, min(8, count))} strings, no commentary.\n"
        f"Hints: roles=[{roles_l}], skills=[{skills_l}]{f}.\n\n"
        f"ResumeText:\n{r_text}\n"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 600},
    }
    try:
        raw = _gemini_generate_content("gemini-2.5-flash", payload)
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
        if "```" in text:
            try:
                fenced = text.split("```")
                text = fenced[2] if len(fenced) >= 3 else fenced[1]
            except Exception:
                pass
        start, end = text.find("["), text.rfind("]")
        if start == -1 or end == -1 or end <= start:
            return None
        data = json.loads(text[start:end+1])
        if isinstance(data, list):
            out = [str(x).strip() for x in data if str(x).strip()]
            # Ensure first two prompts
            seed = ["Introduce yourself.", "Why are you interested in this internship?"]
            for s in reversed(seed):
                if not out or out[0].lower() != s.lower():
                    out.insert(0, s)
            return out[:count]
        return None
    except Exception:
        return None


@router.post("/start")
def start(req: StartRequest, request: Request):
    # Pull resume from session
    resume_text = ""
    roles: List[str] = []
    skills: List[str] = []
    try:
        from main import _get_session_id, _get_session_profile  # type: ignore
        sid = _get_session_id(request)
        r_text, profile = _get_session_profile(sid)
        resume_text = r_text or ""
        roles = sorted(list(profile.get("roles", [])))
        skills = sorted(list(profile.get("skills", [])))
    except Exception:
        pass

    qs = _gemini_questions(resume_text, roles, skills, req.count or 5, req.focus)
    if not qs:
        qs = _default_questions()[: (req.count or 5)]

    return {"questions": qs}


class FollowupRequest(BaseModel):
    last_question: str
    user_answer: str
    transcript: Optional[List[Dict[str, str]]] = None  # [{q,a}]


@router.post("/followup")
def followup(req: FollowupRequest, request: Request):
    # Use Gemini to produce a short follow-up question and one-paragraph feedback
    try:
        from main import _gemini_generate_content, GOOGLE_API_KEY  # type: ignore
        if not GOOGLE_API_KEY:
            raise RuntimeError("no key")
    except Exception:
        # Fallback: static follow-up
        nq = "What is one improvement you would make to your previous project?"
        fb = "Good effort. Try to be specific with technologies and outcomes; quantify results when possible."
        return {"next_question": nq, "feedback": fb}

    history = req.transcript or []
    hist = "\n".join([f"Q: {h.get('q','')}\nA: {h.get('a','')}" for h in history][-4:])
    prompt = (
        "You are a concise mock interviewer. Based on the previous Q/A (if any), the last question and the user's answer,\n"
        "1) write ONE short follow-up question (tech-friendly, easy).\n"
        "2) provide a brief 2-4 sentence feedback on the user's answer.\n"
        "Return ONLY minified JSON: {\"next\": \"...\", \"feedback\": \"...\"}. No extra text.\n\n"
        f"Previous:\n{hist}\n\nLastQ: {req.last_question}\nAnswer: {req.user_answer}\n"
    )
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.5, "maxOutputTokens": 500}}
    try:
        raw = _gemini_generate_content("gemini-2.5-flash", payload)
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
            raise RuntimeError("empty")
        if "```" in text:
            try:
                fenced = text.split("```")
                text = fenced[2] if len(fenced) >= 3 else fenced[1]
            except Exception:
                pass
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise RuntimeError("nojson")
        data = json.loads(text[start:end+1])
        nq = str(data.get("next") or "Could you elaborate with a simple example?").strip()
        fb = str(data.get("feedback") or "Nice answer. Be concise and quantify outcomes.").strip()
        return {"next_question": nq, "feedback": fb}
    except Exception:
        return {"next_question": "Could you share a simple example from your resume?", "feedback": "Solid start. Add specifics (tech used, your role, result)."}
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
