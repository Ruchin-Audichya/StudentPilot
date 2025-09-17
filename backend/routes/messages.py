from __future__ import annotations

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/messages", tags=["messages"])


class ResumeJSON(BaseModel):
  name: Optional[str] = None
  email: Optional[str] = None
  phone: Optional[str] = None
  summary: Optional[str] = None
  skills: Optional[List[str]] = None
  education: Optional[List[Dict[str, Any]]] = None
  experience: Optional[List[Dict[str, Any]]] = None
  projects: Optional[List[Dict[str, Any]]] = None
  location: Optional[str] = None


class JobDesc(BaseModel):
  title: str
  company: Optional[str] = None
  description: Optional[str] = None
  location: Optional[str] = None


class MessageRequest(BaseModel):
  resume: ResumeJSON
  job: JobDesc
  mode: str = Field("cover_letter", description="'cover_letter' or 'linkedin' for connection message")
  model: Optional[str] = Field(None, description="Optional Gemini model override")


def _template_message(resume: Dict[str, Any], job: Dict[str, Any], mode: str) -> str:
  name = (resume.get("name") or "Candidate").strip()
  role = (job.get("title") or "Intern").strip()
  company = (job.get("company") or "your company").strip()
  skills = ", ".join((resume.get("skills") or [])[:6])
  # Keep to ~6-8 lines
  if (mode or "").lower() == "linkedin":
    return (
      f"Hello {company} Team,\n\n"
      f"I’m {name}, a B.Tech student interested in the {role} internship. "
      f"I’ve worked with {skills or 'relevant technologies'} and would appreciate an opportunity to contribute.\n\n"
      f"Could we connect to discuss fit and next steps?\n\n"
      f"Thank you,\n{name}"
    )
  return (
    f"Dear Hiring Manager,\n\n"
    f"I’m {name}, a B.Tech student applying for the {role} internship at {company}. "
    f"My background includes hands-on experience with {skills or 'relevant technologies'}, and I’m eager to contribute to your team.\n\n"
    f"I would welcome the chance to discuss how I can add value to {company}.\n\n"
    f"Sincerely,\n{name}"
  )


@router.post("/cover-letter")
def generate_message(req: MessageRequest, request: Request) -> Dict[str, Any]:
  # Prefer Gemini when configured; otherwise use a clean template fallback
  try:
    from main import _gemini_generate_content, GOOGLE_API_KEY  # type: ignore
  except Exception:
    _gem = None
    _gkey = ""
  else:
    _gem = _gemini_generate_content
    _gkey = GOOGLE_API_KEY

  if _gem and _gkey:
    try:
      mode = (req.mode or "cover_letter").lower()
      model = (req.model or "gemini-2.5-flash").strip()
      resume = req.resume.model_dump()
      job = req.job.model_dump()
      style = (
        "Write a short, formal, and concise message (6-8 lines). Avoid filler, be specific."
        if mode == "cover_letter"
        else "Write a short, polite LinkedIn connection note (3-5 lines). Be specific and concise."
      )
      text = (
        "You are a professional assistant helping B.Tech students apply for internships.\n"
        f"Task: {style}\n\n"
        "Use the candidate's resume JSON and the internship details to personalize the message.\n"
        "Avoid placeholders and repetitiveness; keep it professional.\n"
        "Return plain text only.\n\n"
        f"Resume JSON:\n{resume}\n\nJob:\n{job}\n"
      )
      payload = {"contents": [{"role": "user", "parts": [{"text": text}]}], "generationConfig": {"temperature": 0.5}}
      raw = _gem(model, payload)
      # Extract first text block
      msg: Optional[str] = None
      try:
        cands = (raw or {}).get("candidates") or []
        if cands:
          parts = (((cands[0] or {}).get("content") or {}).get("parts")) or []
          texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
          msg = ("\n".join(texts)).strip() if texts else None
      except Exception:
        msg = None
      if msg:
        return {"message": msg, "model": model, "mode": mode}
    except Exception as e:
      # fall through to template fallback
      pass

  # Template fallback (no external AI)
  return {
    "message": _template_message(req.resume.model_dump(), req.job.model_dump(), req.mode),
    "model": "template",
    "mode": req.mode,
  }
