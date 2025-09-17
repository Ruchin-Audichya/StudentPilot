import os
import json
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/testimonials", tags=["testimonials"])

_HERE = os.path.dirname(os.path.dirname(__file__))
_DATA_DIR = os.path.join(_HERE, "data")
_UPLOAD_DIR = os.path.join(_HERE, "uploads", "testimonials")
_JSON_PATH = os.path.join(_DATA_DIR, "testimonials.json")

os.makedirs(_DATA_DIR, exist_ok=True)
os.makedirs(_UPLOAD_DIR, exist_ok=True)


class Testimonial(BaseModel):
    id: str
    name: str
    role: Optional[str] = None
    company: Optional[str] = None
    message: str
    image_url: Optional[str] = None  # served via /api/testimonials/image/{filename}
    created_at: str


def _load_all() -> List[Testimonial]:
    if not os.path.exists(_JSON_PATH):
        return []
    try:
        with open(_JSON_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return [Testimonial(**item) for item in raw if isinstance(item, dict)]
    except Exception:
        return []


def _save_all(items: List[Testimonial]):
    with open(_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump([item.dict() for item in items], f, ensure_ascii=False, indent=2)


@router.get("/", response_model=List[Testimonial])
def list_testimonials():
    items = _load_all()
    # Newest first
    items.sort(key=lambda x: x.created_at, reverse=True)
    return items


@router.get("/image/{filename}")
def get_image(filename: str):
    # Prevent directory traversal
    safe = os.path.basename(filename)
    path = os.path.join(_UPLOAD_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.post("/", response_model=Testimonial)
async def submit_testimonial(
    name: str = Form(...),
    message: str = Form(...),
    role: Optional[str] = Form(None),
    company: Optional[str] = Form(None),
    proof: Optional[UploadFile] = File(None),
):
    tid = uuid.uuid4().hex
    created_at = datetime.utcnow().isoformat() + "Z"

    image_url = None
    if proof is not None:
        # Accept only image mime types
        if not (proof.content_type or "").startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are allowed")
        # Generate safe filename
        ext = os.path.splitext(proof.filename or "")[1][:8]
        safe_name = f"{tid}{ext or '.png'}"
        dest = os.path.join(_UPLOAD_DIR, safe_name)
        content = await proof.read()
        with open(dest, "wb") as out:
            out.write(content)
        image_url = f"/api/testimonials/image/{safe_name}"

    item = Testimonial(
        id=tid,
        name=name.strip()[:80],
        role=(role or "").strip()[:80] or None,
        company=(company or "").strip()[:80] or None,
        message=message.strip()[:800],
        image_url=image_url,
        created_at=created_at,
    )

    items = _load_all()
    items.append(item)
    _save_all(items)
    return item
