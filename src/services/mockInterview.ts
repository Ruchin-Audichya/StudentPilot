import { API_BASE } from "@/lib/apiBase";

const sid = () => {
  try {
    const k = 'wm.session.v1';
    let v = localStorage.getItem(k);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
    return v;
  } catch { return null; }
};

export async function startMockInterview(opts: { focus?: string; count?: number } = {}) {
  const s = sid();
  const res = await fetch(`${API_BASE}/api/mock-interview/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(s ? { 'X-Session-Id': s } : {}) },
    body: JSON.stringify({ focus: opts.focus, count: opts.count ?? 6 }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ session_id?: string; questions: string[] }>;
}

export async function followupQuestion(payload: { last_question: string; user_answer: string; transcript?: { q: string; a: string }[] }) {
  const s = sid();
  const res = await fetch(`${API_BASE}/api/mock-interview/followup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(s ? { 'X-Session-Id': s } : {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ session_id?: string; next_question: string }>;
}
