from __future__ import annotations

import re
from typing import Dict, List, Optional, Iterable, Tuple


_STOP = {
    "the","and","for","with","this","that","you","your","from","into","will","are","our",
    "to","in","on","at","of","as","by","be","an","a","or","we","it","is","if","about",
    "intern","internship","job","role","work","team","company","skills","experience","requirements",
}


def _norm(text: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _tokens(text: str) -> List[str]:
    # Keep alphanumerics and tech symbols (+, #, .) common in C++, C#, Node.js
    toks = re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{1,30}", text.lower())
    return [t for t in toks if len(t) >= 3 and t not in _STOP]


def _top_keywords(text: str, limit: int = 20) -> List[str]:
    # Frequency-based selection; de-duplicate in order
    freq: Dict[str, int] = {}
    for t in _tokens(text):
        freq[t] = freq.get(t, 0) + 1
    # Prefer words that look like skills/tech
    tech_bias = {"python","java","javascript","typescript","react","node","django","fastapi","sql","mongodb","aws","docker","flutter","android","ios","pandas","numpy","ml","ai","kotlin","spring","go","golang","c++","c#","nextjs","express","postgre","mysql"}
    items = sorted(freq.items(), key=lambda kv: (kv[0] in tech_bias, kv[1], -len(kv[0])), reverse=True)
    out: List[str] = []
    for k, _ in items:
        if k not in out:
            out.append(k)
        if len(out) >= limit:
            break
    return out


def analyze_resume_vs_jobs(
    resume_text: str,
    resume_skills: Iterable[str] | None,
    jobs: List[Dict],
    top_job_keywords: int = 20,
    top_missing: int = 8,
) -> Dict:
    """Return per-job score and missing keywords, plus overall suggestions.

    Output shape:
      {
        results: [ { title, company?, url?, score, matched_keywords: [...], missing_keywords: [...] } ],
        suggestions: [ ... ]
      }
    """
    r_text = _norm(resume_text)
    r_toks = set(_tokens(r_text))
    r_skills = {str(s).strip().lower() for s in (resume_skills or []) if str(s).strip()}
    r_all = r_toks | r_skills

    analyzed: List[Dict] = []
    missing_counter: Dict[str, int] = {}

    for job in jobs or []:
        title = _norm(job.get("title"))
        company = _norm(job.get("company"))
        desc = _norm(job.get("description"))
        tags = {str(t).lower() for t in (job.get("tags") or []) if str(t).strip()}
        url = job.get("url") or job.get("apply_url") or ""

        # Build job keyword set from description + title + tags
        job_text = f"{title} {desc} {' '.join(sorted(tags))}"
        j_keywords = _top_keywords(job_text, limit=top_job_keywords)
        j_set = set(j_keywords)

        matches = sorted(list(j_set & r_all))
        miss = sorted([k for k in j_keywords if k not in r_all])

        coverage = len(matches) / max(1, len(j_set))
        # scale to 0..100 with mild non-linearity
        score = round(min(100.0, max(0.0, (coverage ** 0.9) * 100)), 2)

        for m in miss:
            missing_counter[m] = missing_counter.get(m, 0) + 1

        analyzed.append({
            "title": title,
            "company": company,
            "url": url,
            "score": score,
            "matched_keywords": matches[:top_missing],
            "missing_keywords": miss[:top_missing],
        })

    # Rank overall suggestions by how many jobs require the keyword
    suggestions = [k for k, _ in sorted(missing_counter.items(), key=lambda kv: (kv[1], len(kv[0])), reverse=True)[:top_missing]]

    return {"results": analyzed, "suggestions": suggestions}
