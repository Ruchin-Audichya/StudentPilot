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
  const body = {
    message,
    session_id: getClientSessionId(),
    model: (model || "deepseek/deepseek-chat-v3-0324:free").trim()
  };
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": body.session_id },
      body: JSON.stringify(body),
      signal
    });
    if (!res.ok) {
      yield `⚠️ Chat request failed: ${res.status}`;
      return;
    }
    const data = await res.json();
    let reply = data.response || data.choices?.[0]?.message?.content || "No response";
    yield sanitizeAndShapeReply(reply);
  } catch (err) {
    yield `⚠️ Chat request failed: ${err}`;
  }
}
