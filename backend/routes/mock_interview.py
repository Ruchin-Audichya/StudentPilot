from __future__ import annotations

from typing import List, Dict, Optional
from fastapi import APIRouter, Request
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
