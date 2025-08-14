import { auth } from '@/lib/firebase';

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export type ChatHistoryItem = {
  text: string;
  isUser: boolean;
};

export type ChatProfile = {
  name: string;
  college: string;
  branch: string;
  year: string;
  skills: string[];
  interests: string[];
};

export async function chatWithAssistant(
  message: string,
  profile: ChatProfile,
  history: ChatHistoryItem[] = []
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Optional auth: include Firebase ID token if available; backend accepts id_token header when enabled
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers['id_token'] = token;
  } catch {}

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers,
    // Backend expects only { message }
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    // Try to surface structured error if present
    try {
      const err = await res.json();
      throw new Error(err?.detail || err?.message || 'Chat API error');
    } catch {
      const text = await res.text();
      throw new Error(text || 'Chat API error');
    }
  }
  const data = await res.json();
  const reply = (data && (data.response ?? data.reply)) as string | undefined;
  if (!reply) throw new Error('Empty response from chat API');
  return reply;
}
