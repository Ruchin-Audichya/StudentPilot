// Central API base resolution for both local dev and Vercel deployment.
// Rules:
// - If running on a vercel.app host and VITE_API_BASE is empty or points to localhost/127.*, use the serverless proxy /api/backend
// - Otherwise use provided VITE_API_BASE (trim trailing slash)
// - In local dev fallback to http://127.0.0.1:8000

function computeApiBase(): string {
  const isBrowser = typeof window !== 'undefined';
  const raw: string | undefined = (import.meta as any)?.env?.VITE_API_BASE;
  const cleaned = raw?.trim();
  const isVercel = isBrowser && window.location.hostname.endsWith('vercel.app');
  if (isVercel) {
    if (!cleaned || /^(https?:\/\/(localhost|127\.0\.0\.1)|localhost)/i.test(cleaned)) {
      return '/api/backend';
    }
    return cleaned.replace(/\/$/, '');
  }
  if (cleaned) return cleaned.replace(/\/$/, '');
  return 'http://127.0.0.1:8000';
}

export const API_BASE = computeApiBase();
