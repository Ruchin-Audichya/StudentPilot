// Lightweight HTTP helpers for consistent timeouts and session headers
// Usage: import { fetchWithTimeout, readJsonSafe, buildSessionHeaders } from '@/lib/http'

export function getSessionId(): string | null {
  try {
    const key = 'wm.session.v1';
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return null;
  }
}

export function buildSessionHeaders(init?: Record<string, string>): Record<string, string> {
  const sid = getSessionId();
  return { ...(init || {}), ...(sid ? { 'X-Session-Id': sid } : {}) };
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function readJsonSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    const txt = await res.text().catch(() => '');
    return { error: txt || `HTTP ${res.status}` };
  }
}
