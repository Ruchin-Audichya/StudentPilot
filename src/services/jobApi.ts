export interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  stipend?: string;
  url: string;
  source: string;
  description?: string;
  posted_at?: string;
  required_skills?: string[];
  // Optional visual indicators if backend provides them
  is_new?: boolean;
  score?: number; // 0-100
}

export interface JobSearchParams {
  skills: string[];
  interests: string[];
  location?: string;
}

import { API_BASE } from "../lib/apiBase";

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

export async function searchInternships(params: JobSearchParams): Promise<JobResult[]> {
  const sid = getClientSessionId();
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(sid ? { "X-Session-Id": sid } : {}) },
    body: JSON.stringify({
  // Use a soft query; backend will fallback to resume keywords if needed
  query: [...params.skills, ...params.interests].filter(Boolean).slice(0, 6).join(" ") || "",
      filters: { location: params.location || "India", experience_level: "internship" },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data || []).map((x: any, idx: number) => ({
    id: x.apply_url || String(idx),
    title: x.title,
    company: x.company,
    location: x.location,
    type: "internship",
    stipend: x.stipend || "",
    url: x.apply_url,
    source: x.source || "internshala",
    description: x.description || "",
    posted_at: x.posted_at || undefined,
    required_skills: x.tags || [],
  is_new: x.is_new,
  score: typeof x.score === 'number' ? x.score : undefined,
  }));
}
