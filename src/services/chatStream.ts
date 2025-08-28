// src/services/chatStream.ts
import { API_BASE } from "@/lib/apiBase";

export async function* streamChat({
  model,
  messages,
  signal,
}: {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  // Temporarily disable streaming; use non-stream POST to backend
  const body = {
    model: model || "openai/gpt-oss-20b:free",
    messages: [
      { role: "system", content: "You are a resume-aware assistant. Keep replies short, bullet-pointed, with light emojis." },
      ...messages,
    ],
    stream: false
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
    yield data.response || "No response";
  } catch (err) {
    yield `⚠️ Chat request failed: ${err}`;
  }
}
