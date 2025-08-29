// src/services/chatStream.ts
import { API_BASE } from "@/lib/apiBase";
import { sanitizeAndShapeReply } from "@/utils/chatFormat";
import { FREE_MODELS } from "@/constants/models";

export async function* streamChat({
  message,
  model,
  signal,
}: {
  message: string;
  model: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  // Validate model
  const allowedModels = FREE_MODELS.map(m => m.id);
  const safeModel = allowedModels.includes((model || "").trim()) ? (model || "").trim() : "openai/gpt-oss-20b:free";
  const body = {
    message,
    model: safeModel
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
