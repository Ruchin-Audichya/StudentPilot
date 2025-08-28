// src/services/chatStream.ts
import { API_BASE } from "@/lib/apiBase";
import { sanitizeAndShapeReply } from "@/utils/chatFormat";

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
    model: (model || "openai/gpt-oss-20b:free").trim()
  };
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
