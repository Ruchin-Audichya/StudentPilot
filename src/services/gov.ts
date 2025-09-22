import { API_BASE } from "@/lib/apiBase";
import type { JobResult } from "@/services/jobApi";

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

export async function fetchGovFeeds(opts: { state?: string; only_verified?: boolean; limit?: number; force?: boolean } = {}): Promise<JobResult[]> {
  const payload = {
    state: opts.state || undefined,
    only_verified: !!opts.only_verified,
    limit: opts.limit ?? 50,
  };
  const sid = getClientSessionId();

  async function post(path: string) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(sid ? { "X-Session-Id": sid } : {}) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  let data: any;
  try {
    const qp = opts.force ? `?force=true&t=${Date.now()}` : "";
    data = await post(`/api/v1/gov/feeds/live${qp}`);
  } catch {
    data = await post(`/api/v1/gov/feeds`);
  }
  const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.items) ? data.items : []);
  return items.map((x: any, idx: number) => ({
    id: x.apply_url || x.url || String(idx),
    title: x.title,
    company: x.company || x.dept || "Government",
    location: x.location || (x.state || "India"),
    type: "internship",
    stipend: x.stipend || "",
    url: x.apply_url || x.url,
    source: x.source || "gov",
    description: x.description || "",
    posted_at: x.posted_at || undefined,
    required_skills: x.tags || [],
    is_new: x.is_new,
    score: typeof x.score === 'number' ? x.score : undefined,
  }));
}

export const govApi = { fetchGovFeeds };
