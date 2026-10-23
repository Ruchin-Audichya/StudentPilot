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
  tags?: string[];
  verified?: boolean;
  missing_keywords?: string[];
}

type BackendJob = { apply_url?: string; title?: string; company?: string; location?: string; stipend?: string;
  source?: string; description?: string; posted_at?: string; tags?: string[]; is_new?: boolean; score?: number };

export interface JobSearchParams {
  skills: string[];
  interests: string[];
  location?: string;
}

import { API_BASE } from "../lib/apiBase";
import { jobRequest, jobPost, type Health, type JobState } from "../lib/jobs";

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
  // One role with a small skill hint searches better than six unrelated terms.
  query: [params.interests.find(Boolean), ...params.skills.filter(Boolean).slice(0, 2)].filter(Boolean).join(" ") || "internship",
      filters: { location: params.location || "India", experience_level: "internship" },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data: unknown = await res.json();
  return (Array.isArray(data) ? data as BackendJob[] : []).map((x, idx: number) => ({
    id: x.apply_url || String(idx),
    title: x.title || '',
    company: x.company || '',
    location: x.location || '',
    type: "internship",
    stipend: x.stipend || "",
    url: x.apply_url || '',
    source: x.source || "internshala",
    description: x.description || "",
    posted_at: x.posted_at || undefined,
    required_skills: x.tags || [],
    tags: x.tags || [],
  is_new: x.is_new,
  score: typeof x.score === 'number' ? x.score : undefined,
  }));
}

export type SearchCoverage = { source: string; count: number; rejected: number; error: string | null };

// StudentPilot's existing scrapers and the twelve-board search run together.
// Each source reports its own outcome; the UI never invents a listing on failure.
export async function searchInternshipsExpanded(params: JobSearchParams): Promise<{ jobs: JobResult[]; coverage: SearchCoverage[] }> {
  const primary = searchInternships(params);
  const expanded = (async () => {
    const health = await jobRequest<Health>('/health');
    if (!health.search) return { jobs: [] as JobResult[], coverage: [{ source: '12 job boards + company careers', count: 0, rejected: 0, error: 'Configure BRAVE_SEARCH_API_KEY on the job service' }] };
    const role = params.interests.find(Boolean) || params.skills.find(Boolean) || 'internship';
    const state = await jobPost('/search', {
      role: /intern/i.test(role) ? role : `${role} internship`, location: params.location || 'India',
      sources: health.platforms.map(source => source.id),
      careerDomains: ['careers.google.com', 'microsoft.com', 'amazon.jobs', 'careers.atlassian.com', 'careers.adobe.com'],
    }) as JobState;
    const found = new Set(state.searchJobIds || []);
    return {
      jobs: state.jobs.filter(job => found.has(job.id)).map(job => ({
        id: job.id, title: job.title, company: job.company, location: params.location || 'India',
        type: 'internship', url: job.url, source: job.source, description: job.description,
      })),
      coverage: state.coverage,
    };
  })();
  const [baseResult, expandedResult] = await Promise.allSettled([primary, expanded]);
  if (baseResult.status === 'rejected' && expandedResult.status === 'rejected') throw baseResult.reason;
  const baseJobs = baseResult.status === 'fulfilled' ? baseResult.value : [];
  const boardData = expandedResult.status === 'fulfilled' ? expandedResult.value : {
    jobs: [] as JobResult[], coverage: [{ source: '12 job boards + company careers', count: 0, rejected: 0, error: 'Job search service unavailable' }],
  };
  const coverage = [
    { source: 'StudentPilot scrapers', count: baseJobs.length, rejected: 0, error: baseResult.status === 'rejected' ? String(baseResult.reason) : null },
    ...boardData.coverage,
  ];
  return { jobs: [...baseJobs, ...boardData.jobs], coverage };
}
