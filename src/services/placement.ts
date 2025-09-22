import { API_BASE } from "@/lib/apiBase";

function userId() { try { return localStorage.getItem('campus.user.id') || 'student_demo'; } catch { return 'student_demo'; } }
function adminHeaders() { return { 'x-role': 'admin', 'x-user-id': 'admin_demo' } as Record<string,string>; }
function studentHeaders() { return { 'x-user-id': userId() } as Record<string,string>; }

export const placementApi = {
  async listPostings(){ const r = await fetch(`${API_BASE}/api/v1/placement/postings`); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async getPosting(id:string){ const r = await fetch(`${API_BASE}/api/v1/placement/postings/${id}`); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async createPosting(p:{title:string;company:string;role:string;description:string;tags?:string[]}){ const r=await fetch(`${API_BASE}/api/v1/placement/postings`,{method:'POST',headers:{'Content-Type':'application/json',...adminHeaders()},body:JSON.stringify(p)}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async apply(pid:string, a:{resume_url?:string}){ const r=await fetch(`${API_BASE}/api/v1/placement/postings/${pid}/apply`,{method:'POST',headers:{'Content-Type':'application/json',...studentHeaders()},body:JSON.stringify(a)}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async applicants(pid:string){ const r=await fetch(`${API_BASE}/api/v1/placement/admin/postings/${pid}/applicants`,{headers:adminHeaders()}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async updateStatus(appId:string, status:string){ const r=await fetch(`${API_BASE}/api/v1/placement/admin/applications/${appId}/status`,{method:'PUT',headers:{'Content-Type':'application/json',...adminHeaders()},body:JSON.stringify({status})}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async schedule(appId:string, when:string){ const r=await fetch(`${API_BASE}/api/v1/placement/admin/applications/${appId}/interview`,{method:'POST',headers:{'Content-Type':'application/json',...adminHeaders()},body:JSON.stringify({interview_at:when})}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  streamUrl(){ return `${API_BASE}/api/v1/placement/stream`; }
}
