import { API_BASE } from "@/lib/apiBase";
import type { JobResult } from "@/services/jobApi";

export async function fetchGovFeeds(opts: { state?: string; only_verified?: boolean; limit?: number }): Promise<JobResult[]> {
  const payload = {
    state: opts.state || undefined,
    only_verified: !!opts.only_verified,
    limit: opts.limit ?? 50,
  };

  async function request(path: string) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  let data: any;
  try {
    // Prefer live aggregated + cached endpoint
    data = await request(`/api/gov/feeds/live`);
  } catch {
    // Fallback to seeded endpoint
    data = await request(`/api/gov/feeds`);
  }
  const items = Array.isArray(data?.results) ? data.results : [];
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
