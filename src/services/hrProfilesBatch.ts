import { API_BASE } from "@/lib/apiBase";

export interface HRProfileLink { label: string; url: string }
export interface HRProfilesBatchItem { company: string; profiles: HRProfileLink[] }

export async function fetchHRProfilesBatch(input: {
  companies: string[];
  roles?: string[];
  location?: string;
  skills?: string[];
  per_company_limit?: number;
}): Promise<HRProfilesBatchItem[]> {
  const res = await fetch(`${API_BASE}/api/linkedin/hr-profiles/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data?.items as HRProfilesBatchItem[]) || [];
}
