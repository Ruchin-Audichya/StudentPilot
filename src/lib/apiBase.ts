// Central API base resolution for both local dev and Vercel deployment.
// Rules:
// - If running on a vercel.app host and VITE_API_BASE is empty or points to localhost/127.*, use the serverless proxy /api/backend
// - Otherwise use provided VITE_API_BASE (trim trailing slash)
// - In local dev fallback to http://127.0.0.1:8000

function computeApiBase(): string {
  const isBrowser = typeof window !== 'undefined';
  const raw: string | undefined = (import.meta as any)?.env?.VITE_API_BASE;
  let cleaned = raw?.trim();
  const isVercel = isBrowser && window.location.hostname.endsWith('vercel.app');
  const isHostedHttps = isBrowser && window.location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  // Allow runtime override for debugging without rebuild
  try {
    if (isBrowser) {
      const ov = localStorage.getItem('API_BASE_OVERRIDE');
      if (ov && /^https?:\/\//i.test(ov)) {
        return ov.replace(/\/$/, '');
      }
    }
  } catch {/* ignore */}

  // Normalize provided VITE_API_BASE (add protocol if missing)
  if (cleaned && !/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  // Validate URL shape
  const isValidUrl = (val?: string) => {
    if (!val) return false;
    try {
      // eslint-disable-next-line no-new
      new URL(val);
      return true;
    } catch {
      return false;
    }
  };

  if (isVercel || isHostedHttps) {
    // If no explicit base (or it's pointing to localhost), fall back to direct Render backend domain (bypasses rewrites)
    if (!cleaned || /^(https?:\/\/(localhost|127\.0\.0\.1)|localhost)/i.test(cleaned) || !isValidUrl(cleaned)) {
  return 'https://studentpilot.onrender.com';
    }
    return cleaned.replace(/\/$/, '');
  }

  if (cleaned && isValidUrl(cleaned)) return cleaned.replace(/\/$/, '');
  return 'http://127.0.0.1:8000';
}

export const API_BASE = computeApiBase();

// Lightweight user log (fire and forget). Import where auth user becomes available.
export async function logUserEvent(user: { uid: string; isAnonymous?: boolean; email?: string | null }) {
  try {
    await fetch(`${API_BASE}/api/log-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        is_anonymous: user.isAnonymous ?? true,
        email: user.email || undefined,
        platform: navigator?.userAgent?.slice(0,120) || undefined,
      }),
    });
  } catch {/* ignore */}
}
