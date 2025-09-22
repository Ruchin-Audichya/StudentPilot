from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from utils.recommender import rank_internships


router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


class ResumeModel(BaseModel):
    skills: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    location: Optional[str] = None
    experience: Optional[List[Dict[str, Any]]] = None
    preferred_tags: Optional[List[str]] = None


class JobModel(BaseModel):
    title: str
    description: str
    location: Optional[str] = None
    tags: Optional[List[str]] = None
    url: Optional[str] = None


class RankRequest(BaseModel):
    resume: ResumeModel = Field(..., description="Parsed resume JSON")
    jobs: List[JobModel] = Field(..., description="List of job dicts to rank")
    k: int = Field(5, ge=1, le=50)


@router.post("/rank")
def rank(req: RankRequest):
    try:
        ranked = rank_internships(req.resume.model_dump(), [j.model_dump() for j in req.jobs], k=req.k)
        return {"results": ranked, "count": len(ranked)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
