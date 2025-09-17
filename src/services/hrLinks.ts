import { API_BASE } from "@/lib/apiBase";

export interface HRLinksRequest {
  resume_text?: string;
  skills?: string[];
  roles?: string[];
  location?: string;
  limit?: number;
}

export interface HRLinksResponse {
  links: string[];
  from: "explicit" | "session" | "resume_text";
}

function getClientSessionId(): string | null {
  try {
    const key = "wm.session.v1";
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

export async function fetchHRLinks(req: HRLinksRequest): Promise<HRLinksResponse> {
  const sid = getClientSessionId();
  const res = await fetch(`${API_BASE}/api/linkedin/hr-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(sid ? { "X-Session-Id": sid } : {}) },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
