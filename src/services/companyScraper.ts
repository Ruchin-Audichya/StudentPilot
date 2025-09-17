import { API_BASE } from "@/lib/apiBase";

export type CompanyJob = {
  title: string;
  location: string;
  apply_url: string;
  description?: string;
  company?: string;
  source?: string;
};

export type ScrapeBatchResponse = {
  results: CompanyJob[];
  errors: { url: string; error: string }[];
};

export async function scrapeCompany(url: string, limit = 30): Promise<CompanyJob[]> {
  const resp = await fetch(`${API_BASE}/api/internships/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit }),
  });
  if (!resp.ok) throw new Error(`Scrape failed: ${resp.status}`);
  return (await resp.json()) as CompanyJob[];
}

export async function scrapeBatch(urls: string[], limitPerSite = 30): Promise<ScrapeBatchResponse> {
  const resp = await fetch(`${API_BASE}/api/internships/scrape-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, limit_per_site: limitPerSite }),
  });
  if (!resp.ok) throw new Error(`Scrape-batch failed: ${resp.status}`);
  return (await resp.json()) as ScrapeBatchResponse;
}
