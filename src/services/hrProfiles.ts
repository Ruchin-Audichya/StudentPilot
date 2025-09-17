import { API_BASE } from "@/lib/apiBase";

export interface HRProfileLink {
  label: string;
  url: string;
}

export async function fetchHRProfiles(input: {
  company?: string;
  roles?: string[];
  location?: string;
  skills?: string[];
  limit?: number;
}): Promise<HRProfileLink[]> {
  const res = await fetch(`${API_BASE}/api/linkedin/hr-profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data?.profiles as HRProfileLink[]) || [];
}
