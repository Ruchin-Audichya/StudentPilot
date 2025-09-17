from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

try:
    from scrapers.company_pages import scrape_company_careers, scrape_multiple
except Exception as e:  # pragma: no cover
    scrape_company_careers = None
    scrape_multiple = None
    _IMPORT_ERR = e
else:
    _IMPORT_ERR = None


router = APIRouter(prefix="/api/internships", tags=["internships-scraper"])


class ScrapeOneRequest(BaseModel):
    url: HttpUrl
    limit: Optional[int] = 50


class ScrapeManyRequest(BaseModel):
    urls: List[HttpUrl]
    limit_per_site: Optional[int] = 50


@router.post("/scrape")
def scrape_single(req: ScrapeOneRequest) -> List[Dict]:
    if _IMPORT_ERR:
        raise HTTPException(status_code=500, detail=f"scraper unavailable: {_IMPORT_ERR}")
    items = scrape_company_careers(str(req.url), limit=req.limit or 50)  # type: ignore
    return items


@router.post("/scrape-batch")
def scrape_batch(req: ScrapeManyRequest) -> Dict:
    if _IMPORT_ERR:
        raise HTTPException(status_code=500, detail=f"scraper unavailable: {_IMPORT_ERR}")
    results, errors = scrape_multiple([str(u) for u in req.urls], limit_per_site=req.limit_per_site or 50)  # type: ignore
    return {"results": results, "errors": errors}
