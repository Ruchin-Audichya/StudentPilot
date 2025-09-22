from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import sqlite3, os, json, time, threading
from datetime import datetime, timedelta
from typing import Optional, List

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "campus.db")
DB_PATH = os.path.abspath(DB_PATH)

_listeners = set()  # simple SSE listeners set
_lock = threading.Lock()

def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _init():
    conn = _db()
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS announcements(
        id TEXT PRIMARY KEY,
        title TEXT,
        body TEXT,
        target TEXT,
        scheduled_at TEXT,
        created_by TEXT,
        attachments TEXT,
        is_pinned INTEGER DEFAULT 0,
        is_draft INTEGER DEFAULT 0,
        tags TEXT,
        published_at TEXT,
        created_at TEXT
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS read_receipts(
        id TEXT PRIMARY KEY,
        user_id TEXT,
        announcement_id TEXT,
        read_at TEXT,
        acknowledged_at TEXT
    )
    """)
    conn.commit(); conn.close()
    _migrate()
    _ensure_publisher()

def _migrate():
    # Add columns if missing (additive-only)
    conn = _db(); cur = conn.cursor()
    cols = {r[1] for r in cur.execute("PRAGMA table_info(announcements)").fetchall()}
    to_add = []
    if "is_draft" not in cols: to_add.append("ALTER TABLE announcements ADD COLUMN is_draft INTEGER DEFAULT 0")
    if "tags" not in cols: to_add.append("ALTER TABLE announcements ADD COLUMN tags TEXT")
    if "published_at" not in cols: to_add.append("ALTER TABLE announcements ADD COLUMN published_at TEXT")
    for stmt in to_add:
        try: cur.execute(stmt)
        except Exception: pass
    conn.commit(); conn.close()

_publisher_started = False

def _ensure_publisher():
    global _publisher_started
    if _publisher_started: return
    _publisher_started = True
    th = threading.Thread(target=_publisher_loop, daemon=True)
    th.start()

def _publisher_loop():
    while True:
        try:
            now = datetime.utcnow().isoformat()
            conn = _db(); cur = conn.cursor()
            rows = cur.execute("SELECT id, scheduled_at, published_at, is_draft FROM announcements").fetchall()
            for r in rows:
                if r["is_draft"]:
                    continue
                sch = r["scheduled_at"]
                pub = r["published_at"]
                if sch and sch > now:
                    continue
                if not pub:
                    # publish now
                    cur.execute("UPDATE announcements SET published_at=? WHERE id=?", (now, r["id"]))
                    conn.commit()
                    _broadcast({"type":"new","id": r["id"]})
            conn.close()
        except Exception:
            pass
        time.sleep(15)

_init()

router = APIRouter(prefix="/api/v1/campus", tags=["campus"])

class AnnouncementIn(BaseModel):
    title: str
    body: str
    target: Optional[dict] = None  # { departments:[], years:[], tags:[] }
    scheduled_at: Optional[str] = None
    created_by: Optional[str] = None
    attachments: Optional[List[str]] = None
    is_pinned: Optional[bool] = False
    is_draft: Optional[bool] = False
    tags: Optional[List[str]] = None

def _uuid():
    import uuid
    return uuid.uuid4().hex

def _now_iso():
    return datetime.utcnow().isoformat()

@router.post("/announcements")
def create_announcement(a: AnnouncementIn, request: Request):
    _require_admin(request)
    conn = _db(); cur = conn.cursor()
    id_ = _uuid()
    now = _now_iso()
    published_at = None
    is_draft = 1 if a.is_draft else 0
    # immediate publish if not draft and not scheduled in future
    if not is_draft and (not a.scheduled_at or a.scheduled_at <= now):
        published_at = now
    cur.execute("INSERT INTO announcements(id,title,body,target,scheduled_at,created_by,attachments,is_pinned,is_draft,tags,published_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (id_, a.title, a.body, json.dumps(a.target or {}), a.scheduled_at, a.created_by or "admin_demo", json.dumps(a.attachments or []), 1 if a.is_pinned else 0, is_draft, json.dumps(a.tags or []), published_at, now))
    conn.commit(); conn.close()
    if published_at:
        _broadcast({"type":"new","id":id_})
    return {"id": id_}

@router.get("/feed")
def student_feed(dept: Optional[str] = None, year: Optional[str] = None, unread: Optional[bool] = False, user_id: Optional[str] = None):
    conn = _db(); cur = conn.cursor()
    now = _now_iso()
    rows = cur.execute("SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC").fetchall()
    out = []
    for r in rows:
        # only published
        if not r["published_at"] or (r["scheduled_at"] and r["scheduled_at"] > now):
            continue
        t = json.loads(r["target"] or "{}")
        depts = t.get("departments") or t.get("dept") or []
        years = t.get("years") or t.get("year") or []
        if dept and depts and dept not in depts:
            continue
        if year and years and str(year) not in years:
            continue
        obj = dict(r)
        # receipts for this user
        if user_id:
            rr = cur.execute("SELECT read_at, acknowledged_at FROM read_receipts WHERE user_id=? AND announcement_id=?", (user_id, r["id"]))
            rr = rr.fetchone()
            if rr:
                obj["read_at"], obj["acknowledged_at"] = rr["read_at"], rr["acknowledged_at"]
        if unread and obj.get("read_at"):
            continue
        obj["attachments"] = json.loads(obj.get("attachments") or "[]")
        obj["tags"] = json.loads(obj.get("tags") or "[]")
        out.append(obj)
    conn.close()
    return out

def _set_receipt(aid: str, user_id: str, read: bool = False, ack: bool = False):
    conn = _db(); cur = conn.cursor()
    rid = _uuid()
    # Try update existing
    ex = cur.execute("SELECT id, read_at, acknowledged_at FROM read_receipts WHERE user_id=? AND announcement_id=?", (user_id, aid)).fetchone()
    if ex:
        read_at = ex["read_at"] or (_now_iso() if read else None)
        acknowledged_at = ex["acknowledged_at"] or (_now_iso() if ack else None)
        cur.execute("UPDATE read_receipts SET read_at=?, acknowledged_at=? WHERE id=?", (read_at, acknowledged_at, ex["id"]))
    else:
        cur.execute("INSERT INTO read_receipts(id,user_id,announcement_id,read_at,acknowledged_at) VALUES (?,?,?,?,?)",
                    (rid, user_id, aid, _now_iso() if read else None, _now_iso() if ack else None))
    conn.commit(); conn.close()

@router.post("/announcements/{aid}/read")
def mark_read(aid: str, user_id: Optional[str] = None, request: Request = None):
    uid = _user_id(request) or user_id or "student_demo"
    _set_receipt(aid, uid, read=True, ack=False)
    return {"ok": True}

@router.post("/announcements/{aid}/ack")
def mark_ack(aid: str, user_id: Optional[str] = None, request: Request = None):
    uid = _user_id(request) or user_id or "student_demo"
    _set_receipt(aid, uid, read=False, ack=True)
    return {"ok": True}

@router.get("/admin/analytics")
def analytics():
    conn = _db(); cur = conn.cursor()
    since = (datetime.utcnow() - timedelta(days=1)).isoformat()
    reads = cur.execute("SELECT COUNT(1) AS c FROM read_receipts WHERE read_at IS NOT NULL AND read_at >= ?", (since,)).fetchone()["c"]
    acks = cur.execute("SELECT COUNT(1) AS c FROM read_receipts WHERE acknowledged_at IS NOT NULL", ()).fetchone()["c"]
    conn.close(); return {"reads": reads, "acks": acks}

@router.get("/admin/analytics/segments")
def analytics_segments():
    # Aggregate by department/year using roles.json when available
    roles = _roles()
    conn = _db(); cur = conn.cursor()
    rows = cur.execute("SELECT user_id, read_at, acknowledged_at FROM read_receipts").fetchall()
    by_dept, by_year = {}, {}
    for r in rows:
        uid = r["user_id"]
        info = roles.get(uid, {})
        d = info.get("dept") or info.get("department")
        y = str(info.get("year") or '')
        if d:
            by_dept.setdefault(d, {"reads":0,"acks":0})
            if r["read_at"]: by_dept[d]["reads"] += 1
            if r["acknowledged_at"]: by_dept[d]["acks"] += 1
        if y:
            by_year.setdefault(y, {"reads":0,"acks":0})
            if r["read_at"]: by_year[y]["reads"] += 1
            if r["acknowledged_at"]: by_year[y]["acks"] += 1
    conn.close(); return {"by_department": by_dept, "by_year": by_year}

@router.get("/admin/announcements")
def admin_list(status: Optional[str] = None, request: Request = None):
    _require_admin(request)
    conn = _db(); cur = conn.cursor()
    now = _now_iso()
    rows = cur.execute("SELECT * FROM announcements ORDER BY created_at DESC").fetchall()
    out = []
    for r in rows:
        item = dict(r); item["attachments"] = json.loads(item.get("attachments") or "[]"); item["tags"] = json.loads(item.get("tags") or "[]")
        st = "published" if item.get("published_at") else ("scheduled" if (not item.get("is_draft") and item.get("scheduled_at") and item["scheduled_at"] > now) else ("draft" if item.get("is_draft") else "scheduled"))
        if status and st != status: continue
        item["status"] = st
        out.append(item)
    conn.close(); return out

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    target: Optional[dict] = None
    scheduled_at: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_draft: Optional[bool] = None
    tags: Optional[List[str]] = None

@router.put("/admin/announcements/{aid}")
def admin_update(aid: str, upd: AnnouncementUpdate, request: Request = None):
    _require_admin(request)
    conn = _db(); cur = conn.cursor()
    row = cur.execute("SELECT * FROM announcements WHERE id=?", (aid,)).fetchone()
    if not row:
        conn.close(); raise HTTPException(status_code=404, detail="Not found")
    fields = dict(row)
    if upd.title is not None: fields["title"] = upd.title
    if upd.body is not None: fields["body"] = upd.body
    if upd.target is not None: fields["target"] = json.dumps(upd.target)
    if upd.scheduled_at is not None: fields["scheduled_at"] = upd.scheduled_at
    if upd.is_pinned is not None: fields["is_pinned"] = 1 if upd.is_pinned else 0
    if upd.is_draft is not None: fields["is_draft"] = 1 if upd.is_draft else 0
    if upd.tags is not None: fields["tags"] = json.dumps(upd.tags)
    # publish if transitioning to published now
    if fields.get("is_draft") == 0 and (not fields.get("scheduled_at") or fields["scheduled_at"] <= _now_iso()) and not fields.get("published_at"):
        fields["published_at"] = _now_iso()
    cols = ["title","body","target","scheduled_at","is_pinned","is_draft","tags","published_at"]
    cur.execute(f"UPDATE announcements SET {', '.join([c+'=?' for c in cols])} WHERE id=?", tuple(fields.get(c) for c in cols) + (aid,))
    conn.commit(); conn.close()
    return {"ok": True}

@router.get("/stream")
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
                    # keep-alive
                    yield f": keep-alive\n\n"
    from fastapi.responses import StreamingResponse
    headers = {"Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive"}
    return StreamingResponse(event_generator(), headers=headers)

class queue:
    def __init__(self):
        self._cv = threading.Condition()
        self._items = []
    def put(self, item):
        with self._cv:
            self._items.append(item)
            self._cv.notify()
    def get(self, timeout=None):
        end = time.time() + (timeout or 0)
        with self._cv:
            while not self._items:
                remaining = end - time.time()
                if timeout and remaining <= 0:
                    raise TimeoutError()
                self._cv.wait(remaining if timeout else None)
            return self._items.pop(0)

class _subscribe:
    def __init__(self, q: queue):
        self.q = q
    def __enter__(self):
        with _lock:
            _listeners.add(self.q)
    def __exit__(self, exc_type, exc, tb):
        with _lock:
            _listeners.discard(self.q)

def _broadcast(evt: dict):
    with _lock:
        for q in list(_listeners):
            try:
                q.put(evt)
            except Exception:
                pass

def _roles_path():
    # read roles.json if present under backend/roles.json
    p = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "roles.json"))
    return p

_roles_cache = None
_roles_mtime = 0

def _roles():
    global _roles_cache, _roles_mtime
    p = _roles_path()
    try:
        st = os.stat(p)
        if not _roles_cache or st.st_mtime != _roles_mtime:
            with open(p, 'r', encoding='utf-8') as f:
                _roles_cache = json.load(f)
                _roles_mtime = st.st_mtime
        return _roles_cache or {}
    except Exception:
        return {}

def _user_id(request: Optional[Request]):
    try:
        return (request.headers.get('x-user-id') or '').strip() or None
    except Exception:
        return None

def _user_role(request: Optional[Request]):
    try:
        r = (request.headers.get('x-role') or '').strip() or None
        if r:
            return r
        uid = _user_id(request)
        if uid:
            return (_roles().get(uid) or {}).get('role')
        return None
    except Exception:
        return None

def _require_admin(request: Optional[Request]):
    role = _user_role(request)
    if role != 'admin':
        raise HTTPException(status_code=403, detail='admin only')
