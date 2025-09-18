import { API_BASE } from "@/lib/apiBase";
import type { JobResult } from "@/services/jobApi";

export async function fetchGovFeeds(opts: { state?: string; only_verified?: boolean; limit?: number }): Promise<JobResult[]> {
  const res = await fetch(`${API_BASE}/api/gov/feeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: opts.state || undefined, only_verified: !!opts.only_verified, limit: opts.limit ?? 50 }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const items = Array.isArray(data.results) ? data.results : [];
  return items.map((x: any, idx: number) => ({
    id: x.apply_url || String(idx),
    title: x.title,
    company: x.company,
    location: x.location,
    type: "internship",
    stipend: x.stipend || "",
    url: x.apply_url || x.url,
    source: x.source || "gov",
    description: x.description || "",
    is_new: x.is_new,
    score: typeof x.score === 'number' ? x.score : undefined,
    required_skills: x.tags || [],
  }));
}
