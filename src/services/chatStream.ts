// src/services/chatStream.ts

export async function* streamChat({
  model,
  messages,
  signal,
}: {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  // TODO: Replace with secure key handling
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const body = JSON.stringify({ model, messages, stream: true });

  let lastError: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal,
      });
      if (response.status === 429 || response.status === 500) {
        lastError = await response.text();
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (!response.ok || !response.body) {
        throw new Error(`OpenRouter error: ${response.status} ${await response.text()}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const json = JSON.parse(line.slice(5));
              const token = json.choices?.[0]?.delta?.content;
              if (token) yield token;
            } catch {}
          }
        }
      }
      return;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Failed to stream chat: ${lastError}`);
}
