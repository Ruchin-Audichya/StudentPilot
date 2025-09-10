// src/services/chatStream.ts
import { API_BASE } from "@/lib/apiBase";
import { sanitizeAndShapeReply } from "@/utils/chatFormat";

// Stable client session id to scope chat/resume to this browser tab
function getClientSessionId(): string {
  const key = "wm.session.v1";
  let sid = localStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(key, sid);
  }
  return sid;
}

export async function* streamChat({
  message,
  model,
  signal,
}: {
  message: string;
  model: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const sid = getClientSessionId();
  const body = {
    message,
    model: (model || "deepseek/deepseek-chat-v3-0324:free").trim(),
    session_id: sid,
  };
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": sid },
      body: JSON.stringify(body),
      signal
    });
    if (!res.ok) {
      const hint = res.status >= 500 ? "(server error)" : res.status === 404 ? "(route missing)" : res.status === 401 ? "(auth)" : "";
      yield `⚠️ Chat request failed: ${res.status} ${hint}`;
      return;
    }
    const data = await res.json();
    let reply = data.response || data.choices?.[0]?.message?.content || "No response";
    yield sanitizeAndShapeReply(reply);
  } catch (err: any) {
    const msg = String(err?.message || err);
    const maybeCors = msg.includes('CORS') || msg.includes('cors');
    const maybeOffline = msg.includes('Failed to fetch') || msg.includes('NetworkError');
    yield `⚠️ Chat request failed: ${msg}${maybeCors ? ' (CORS?)' : ''}${maybeOffline ? ' (network?)' : ''}`;
  }
}
