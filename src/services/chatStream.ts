// src/services/chatStream.ts
import { API_BASE } from "@/lib/apiBase";

export async function* streamChat({
  message,
  model,
  signal,
}: {
  message: string;
  model: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  // Temporarily disable streaming; use non-stream POST to backend
  const body = {
    message,
    model: model || "openai/gpt-oss-20b:free"
  };
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
    const data = await res.json();
    if (data.response) {
      yield data.response;
    } else if (data.choices?.[0]?.message?.content) {
      yield data.choices[0].message.content;
    } else {
      yield "No response";
    }
  } catch (err) {
    yield `⚠️ Chat request failed: ${err}`;
  }
}
