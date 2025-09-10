
import type { SearchRequest } from "./types";
import { API_BASE } from "./lib/apiBase";

// Note: profile persistence is handled locally/Firebase in the app; no backend /api/profile endpoint.

export async function uploadResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  const sid = (()=>{ try{ return localStorage.getItem('wm.session.v1') || (localStorage.setItem('wm.session.v1', crypto.randomUUID()), localStorage.getItem('wm.session.v1')); } catch { return null; } })();
  const res = await fetch(`${API_BASE}/api/upload-resume`, {
    method: "POST",
    body: form,
    headers: sid ? { 'X-Session-Id': sid } : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function searchInternships(options: SearchRequest) {
  const sid = (()=>{ try{ return localStorage.getItem('wm.session.v1') || (localStorage.setItem('wm.session.v1', crypto.randomUUID()), localStorage.getItem('wm.session.v1')); } catch { return null; } })();
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(sid ? { 'X-Session-Id': sid } : {}) },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
