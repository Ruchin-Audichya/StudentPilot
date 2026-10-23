import { ensureAnonymousUser } from '@/lib/firebase';

export type Health = {
  authMode: 'local' | 'firebase'; search: boolean; tailoring: boolean; compiler: boolean; browser: boolean;
  platforms: { id: string; name: string; domain: string; applicationSupport: string }[];
};
export type Job = {
  id: string; url: string; title: string; company: string; description: string; source: string;
  postedAt?: string | null; verifiedAt?: string | null; expiresAt?: string | null;
};
export type Application = {
  jobId: string; job: Job; status: string; message: string;
  changes?: string[]; gaps?: string[]; layoutNotes?: string;
  pdfHash?: string | null; reviewedHash?: string | null;
  receipt?: { text: string; url?: string; observedAt: string };
};
export type JobState = {
  profile: Record<string, unknown>; resume: { name: string; hash: string; uploadedAt: string } | null;
  jobs: Job[]; applications: Application[];
  coverage: { source: string; count: number; rejected: number; error: string | null }[];
  searchJobIds?: string[];
  connections?: Record<string, { openedAt: string }>;
  lastRun?: { completed: number; stoppedAt?: string; message: string };
};

const token = async () => {
  const local = sessionStorage.getItem('studentpilotJobToken');
  if (local) return local;
  return (await ensureAnonymousUser())?.getIdToken() || '';
};
export function saveLocalToken(value: string) { sessionStorage.setItem('studentpilotJobToken', value.trim()); }
export function hasLocalToken() { return Boolean(sessionStorage.getItem('studentpilotJobToken')); }

export async function jobRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const bearer = await token();
  const headers = new Headers(options.headers);
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${import.meta.env.VITE_JOBS_API_BASE || '/api/jobs'}${url}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  if (response.headers.get('content-type')?.includes('application/json')) return response.json() as Promise<T>;
  return response.blob() as Promise<T>;
}

export const jobPost = (url: string, value: unknown) => jobRequest<JobState>(url, { method: 'POST', body: JSON.stringify(value) });
export async function jobFile(name: string) {
  const blob = await jobRequest<Blob>(`/files/${name}`);
  return URL.createObjectURL(blob);
}
