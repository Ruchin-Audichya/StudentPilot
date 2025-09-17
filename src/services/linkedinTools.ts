import { API_BASE } from '../lib/apiBase';

export type HRLink = {
  label: string;
  url: string;
};

export async function getHrLinks(input: {
  resumeText?: string;
  skills?: string[];
  roles?: string[];
  location?: string;
  limit?: number;
}): Promise<HRLink[]> {
  const body: any = {};
  if (input.resumeText) body.resume_text = input.resumeText;
  if (input.skills) body.skills = input.skills;
  if (input.roles) body.roles = input.roles;
  if (input.location) body.location = input.location;
  if (input.limit != null) body.limit = input.limit;

  const resp = await fetch(`${API_BASE}/api/linkedin/hr-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HR links failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return (data?.links as HRLink[]) || [];
}
