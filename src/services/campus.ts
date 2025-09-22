import { API_BASE } from "@/lib/apiBase";

function userId() {
  try { return localStorage.getItem('campus.user.id') || 'student_demo'; } catch { return 'student_demo'; }
}
function adminHeaders() {
  return { 'x-role': 'admin', 'x-user-id': 'admin_demo' } as Record<string,string>;
}
function studentHeaders() {
  return { 'x-user-id': userId() } as Record<string,string>;
}

export const campusApi = {
  async getFeed(params: { dept?: string; year?: string; unread?: boolean }) {
    const qs = new URLSearchParams();
    if (params.dept) qs.set('dept', params.dept);
    if (params.year) qs.set('year', String(params.year));
    if (params.unread) qs.set('unread', '1');
    qs.set('user_id', userId());
    const res = await fetch(`${API_BASE}/api/v1/campus/feed?${qs.toString()}`, { headers: studentHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async create(a: { title: string; body: string; target?: any; scheduled_at?: string; is_pinned?: boolean; attachments?: string[] }) {
    const res = await fetch(`${API_BASE}/api/v1/campus/announcements`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...adminHeaders() }, body: JSON.stringify(a) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async ack(id: string) {
    const res = await fetch(`${API_BASE}/api/v1/campus/announcements/${encodeURIComponent(id)}/ack`, { method: 'POST', headers: studentHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async read(id: string) {
    const res = await fetch(`${API_BASE}/api/v1/campus/announcements/${encodeURIComponent(id)}/read`, { method: 'POST', headers: studentHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async analytics() {
    const res = await fetch(`${API_BASE}/api/v1/campus/admin/analytics`, { headers: adminHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async analyticsSegments() {
    const res = await fetch(`${API_BASE}/api/v1/campus/admin/analytics/segments`, { headers: adminHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async listAnnouncements(status?: string) {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    const res = await fetch(`${API_BASE}/api/v1/campus/admin/announcements?${qs.toString()}`, { headers: adminHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async updateAnnouncement(id: string, payload: Partial<{ title:string; body:string; target:any; scheduled_at:string; is_pinned:boolean; is_draft:boolean; tags:string[] }>) {
    const res = await fetch(`${API_BASE}/api/v1/campus/admin/announcements/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...adminHeaders() }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  streamUrl() { return `${API_BASE}/api/v1/campus/stream`; }
}
