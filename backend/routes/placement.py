from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
import os, sqlite3, json, threading, time
from datetime import datetime
from typing import Optional, List

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "campus.db"))

_listeners = set()
_lock = threading.Lock()

def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _init():
    conn = _db(); cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS placement_postings(
      id TEXT PRIMARY KEY,
      title TEXT,
      company TEXT,
      role TEXT,
      description TEXT,
      tags TEXT,
      created_by TEXT,
      created_at TEXT
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS placement_applications(
      id TEXT PRIMARY KEY,
      posting_id TEXT,
      user_id TEXT,
      resume_url TEXT,
      status TEXT,
      applied_at TEXT,
      interview_at TEXT
    )
    """)
    conn.commit(); conn.close()

_init()

router = APIRouter(prefix="/api/v1/placement", tags=["placement"])

def _uuid():
    import uuid; return uuid.uuid4().hex

def _now(): return datetime.utcnow().isoformat()

def _user_id(request: Optional[Request]):
    try: return (request.headers.get('x-user-id') or '').strip() or None
    except: return None

def _user_role(request: Optional[Request]):
    try: return (request.headers.get('x-role') or '').strip() or None
    except: return None

def _require_admin(request: Optional[Request]):
    if _user_role(request) != 'admin':
        raise HTTPException(status_code=403, detail='admin only')

class PostingIn(BaseModel):
    title: str
    company: str
    role: str
    description: str
    tags: Optional[List[str]] = None

@router.post('/postings')
def create_posting(p: PostingIn, request: Request):
    _require_admin(request)
    conn = _db(); cur = conn.cursor()
    pid = _uuid()
    cur.execute("INSERT INTO placement_postings(id,title,company,role,description,tags,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)",
                (pid, p.title, p.company, p.role, p.description, json.dumps(p.tags or []), _user_id(request) or 'admin_demo', _now()))
    conn.commit(); conn.close()
    _broadcast({'type':'posting.new','id': pid})
    return { 'id': pid }

@router.get('/postings')
def list_postings():
    conn = _db(); cur = conn.cursor()
    rows = cur.execute("SELECT * FROM placement_postings ORDER BY created_at DESC").fetchall()
    out = []
    for r in rows:
        item = dict(r); item['tags'] = json.loads(item.get('tags') or '[]'); out.append(item)
    conn.close(); return out

@router.get('/postings/{pid}')
def get_posting(pid: str):
    conn = _db(); cur = conn.cursor()
    r = cur.execute("SELECT * FROM placement_postings WHERE id=?", (pid,)).fetchone()
    if not r: conn.close(); raise HTTPException(status_code=404, detail='not found')
    item = dict(r); item['tags'] = json.loads(item.get('tags') or '[]')
    conn.close(); return item

class ApplyIn(BaseModel):
    resume_url: Optional[str] = None

@router.post('/postings/{pid}/apply')
def apply_posting(pid: str, a: ApplyIn, request: Request):
    uid = _user_id(request) or 'student_demo'
    conn = _db(); cur = conn.cursor()
    # ensure posting exists
    r = cur.execute("SELECT id FROM placement_postings WHERE id=?", (pid,)).fetchone()
    if not r: conn.close(); raise HTTPException(status_code=404, detail='not found')
    app_id = _uuid()
    cur.execute("INSERT INTO placement_applications(id,posting_id,user_id,resume_url,status,applied_at,interview_at) VALUES (?,?,?,?,?,?,?)",
                (app_id, pid, uid, a.resume_url or '', 'applied', _now(), None))
    conn.commit(); conn.close()
    _broadcast({'type':'application.new','id': app_id, 'posting_id': pid, 'user_id': uid})
    return { 'id': app_id }

@router.get('/admin/postings')
def admin_postings(request: Request):
    _require_admin(request)
    return list_postings()

@router.get('/admin/postings/{pid}/applicants')
def admin_applicants(pid: str, request: Request):
    _require_admin(request)
    conn = _db(); cur = conn.cursor()
    rows = cur.execute("SELECT * FROM placement_applications WHERE posting_id=? ORDER BY applied_at DESC", (pid,)).fetchall()
    out = [dict(r) for r in rows]
    conn.close(); return out

class StatusIn(BaseModel):
    status: str  # applied | shortlisted | interview | rejected | offer

@router.put('/admin/applications/{app_id}/status')
def admin_update_status(app_id: str, s: StatusIn, request: Request):
    _require_admin(request)
    conn = _db(); cur = conn.cursor()
    cur.execute("UPDATE placement_applications SET status=? WHERE id=?", (s.status, app_id))
    conn.commit(); conn.close()
    _broadcast({'type':'application.status','id': app_id, 'status': s.status})
    return { 'ok': True }

class InterviewIn(BaseModel):
    interview_at: str

@router.post('/admin/applications/{app_id}/interview')
def admin_schedule_interview(app_id: str, it: InterviewIn, request: Request):
    _require_admin(request)
    conn = _db(); cur = conn.cursor()
    cur.execute("UPDATE placement_applications SET interview_at=?, status=? WHERE id=?", (it.interview_at, 'interview', app_id))
    conn.commit(); conn.close()
    _broadcast({'type':'application.interview','id': app_id, 'interview_at': it.interview_at})
    return { 'ok': True }

@router.get('/stream')
async def stream(request: Request):
    async def event_generator():
        q = queue()
        with _subscribe(q):
            while True:
                if await request.is_disconnected():
                    break
                try:
                    evt = q.get(timeout=15)
                    yield f"data: {json.dumps(evt)}\n\n"
                except TimeoutError:
                    yield f": keep-alive\n\n"
    from fastapi.responses import StreamingResponse
    headers = {"Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive"}
    return StreamingResponse(event_generator(), headers=headers)

class queue:
    def __init__(self):
        self._cv = threading.Condition(); self._items = []
    def put(self, item):
        with self._cv:
            self._items.append(item); self._cv.notify()
    def get(self, timeout=None):
        end = time.time() + (timeout or 0)
        with self._cv:
            while not self._items:
                remaining = end - time.time()
                if timeout and remaining <= 0: raise TimeoutError()
                self._cv.wait(remaining if timeout else None)
            return self._items.pop(0)

class _subscribe:
    def __init__(self, q: queue): self.q = q
    def __enter__(self):
        with _lock: _listeners.add(self.q)
    def __exit__(self, *a):
        with _lock: _listeners.discard(self.q)

def _broadcast(evt: dict):
    with _lock:
        for q in list(_listeners):
            try: q.put(evt)
            except: pass
