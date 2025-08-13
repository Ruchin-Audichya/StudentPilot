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
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, profile, history }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Chat API error');
  }
  const data = await res.json();
  return data.reply as string;
}
