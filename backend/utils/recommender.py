from __future__ import annotations

from typing import Dict, List, Optional, Iterable
import re


def _norm(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _lower_set(xs: Iterable[str] | None) -> set[str]:
    return {str(x).strip().lower() for x in (xs or []) if str(x).strip()}


def _skills_score(resume_skills: set[str], text: str) -> float:
    if not resume_skills:
        return 0.0
    tl = text.lower()
    hits = {s for s in resume_skills if s in tl}
    if not hits:
        return 0.0
    coverage = len(hits) / max(1, len(resume_skills))
    density = len(hits) / max(1, len(set(tl.split())))
    # emphasize coverage, add small density signal
    return min(1.0, 0.8 * coverage + 0.2 * min(0.5, density * 10))


def _role_score(resume_roles: set[str], text: str) -> float:
    if not resume_roles:
        return 0.0
    tl = text.lower()
    return 1.0 if any(r in tl for r in resume_roles) else 0.0


def _location_score(resume_loc: Optional[str], job_loc: Optional[str]) -> float:
    if not resume_loc or not job_loc:
        return 0.0
    rl, jl = resume_loc.lower(), job_loc.lower()
    return 1.0 if rl in jl or jl in rl else 0.0


def _tag_score(job_tags: Iterable[str] | None, preferred: Iterable[str] | None) -> float:
    if not job_tags or not preferred:
        return 0.0
    jt = _lower_set(job_tags)
    pref = _lower_set(preferred)
    if not jt or not pref:
        return 0.0
    inter = jt & pref
    return min(1.0, len(inter) / max(1, len(pref)))


def _exp_keywords(experiences: Iterable[Dict] | None) -> set[str]:
    out: set[str] = set()
    for e in (experiences or []):
        for k in ("title", "description", "projects"):
            t = str(e.get(k, ""))
            tokens = re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{1,30}", t.lower())
            for tok in tokens:
                if len(tok) >= 3:
                    out.add(tok)
    return out


def _experience_score(exp_tokens: set[str], text: str) -> float:
    if not exp_tokens:
        return 0.0
    tl = text.lower()
    hits = {t for t in exp_tokens if t in tl}
    if not hits:
        return 0.0
    return min(1.0, len(hits) / 20.0)  # cap influence


def rank_internships(resume: Dict, internships: List[Dict], k: int = 5) -> List[Dict]:
    """Rank internships for a parsed resume JSON.

    Resume shape (flexible):
      {
        skills: [str],
        roles: [str],
        location: str?,
        experience: [{ title?, description?, projects? }],
        preferred_tags?: [str]
      }

    Internship shape (flexible):
      { title, description, location?, tags?[] }
    """
    skills = _lower_set(resume.get("skills", []))
    roles = _lower_set(resume.get("roles", []))
    loc = _norm(resume.get("location")) or None
    exp_tokens = _exp_keywords(resume.get("experience"))
    preferred_tags = set(resume.get("preferred_tags", []) or [])

    out: List[tuple[float, Dict]] = []
    for job in internships or []:
        title = _norm(job.get("title"))
        desc = _norm(job.get("description"))
        job_loc = _norm(job.get("location"))
        text = f"{title} {desc}"
        # Subscores
        s_skills = _skills_score(skills, text)
        s_roles = _role_score(roles, text)
        s_loc = _location_score(loc, job_loc)
        s_tags = _tag_score(job.get("tags"), preferred_tags)
        s_exp = _experience_score(exp_tokens, text)

        # Weighted blend (tunable)
        score = (
            0.42 * s_skills +
            0.22 * s_roles +
            0.10 * s_loc +
            0.08 * s_tags +
            0.18 * s_exp
        )

        enriched = dict(job)
        enriched["rec_score"] = round(score * 100, 2)
        out.append((score, enriched))

    out.sort(key=lambda x: x[0], reverse=True)
    return [j for _, j in out[: max(1, k)]]
