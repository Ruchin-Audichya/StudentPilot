// services/chatApi.ts
// OpenRouter chat client wired to your free models, resume-aware, concise, emoji formatting.

export type ChatHistoryItem = { text: string; isUser: boolean };
export type ChatProfile = {
  name: string;
  college?: string;
  branch?: string;
  year?: string;
  skills: string[];
  interests: string[];
};

type ORMessage = { role: "system" | "user" | "assistant"; content: string };
type ORChoice = { message: { role: "assistant"; content: string } };
type ORResponse = { id: string; choices: ORChoice[] };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Your free-model priority list */
const FREE_MODELS = [
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-coder:free",
  "tngtech/deepseek-r1t2-chimera:free",
] as const;
export type FreeModel = typeof FREE_MODELS[number];

function profileContext(p: ChatProfile): string {
  const parts: string[] = [];
  if (p.name) parts.push(`Name: ${p.name}`);
  if (p.college) parts.push(`College: ${p.college}`);
  if (p.branch) parts.push(`Branch: ${p.branch}`);
  if (p.year) parts.push(`Year: ${p.year}`);
  if (p.skills?.length) parts.push(`Skills: ${p.skills.join(", ")}`);
  if (p.interests?.length) parts.push(`Interests: ${p.interests.join(", ")}`);
  return parts.join(" • ");
}

/** Tight, resume-aware system style */
function systemPrompt(p: ChatProfile): string {
  return [
    "You are an AI internship & resume co-pilot.",
    "STYLE:",
    "- Keep answers short (~100–160 words). No walls of text.",
    "- Use crisp bullets, **bold** keywords, and emojis sparingly (✅ ✍️ 💼 🛠️ 🎯 🚀).",
    "- Always tailor to the user's resume/profile.",
    "- If rating: 3–5 bullets — strengths, top fixes, 1-line summary.",
    "- If roles: 3–6 role titles with *why fit* + key skills to highlight.",
    "- If JD given: a 3-bullet *match plan* (what to tweak/add), then a 3-item checklist.",
    "- Do not reveal chain-of-thought. Do not include 'analysis:' or 'final:'.",
    "",
    `USER PROFILE → ${profileContext(p)}`,
  ].join("\n");
}

/** Build messages from our history + new user message. */
function buildMessages(userMessage: string, profile: ChatProfile, history: ChatHistoryItem[]): ORMessage[] {
  const messages: ORMessage[] = [{ role: "system", content: systemPrompt(profile) }];
  for (const h of history.slice(-12)) {
    messages.push({ role: h.isUser ? "user" : "assistant", content: h.text });
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}

/** Sanitize model outputs (remove <think>, analysis/final labels, stray XML, collapse whitespace) */
function sanitize(text: string): string {
  if (!text) return "";
  let t = text;
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");
  t = t.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "");
  t = t.replace(/(?<=^|\n)\s*(analysis|reasoning|reflection)\s*:\s*[\s\S]*?(?=\n{2,}|$)/gi, "");
  t = t.replace(/(?<=^|\n)\s*(assistant[_-]?final|final)\s*:\s*/gi, "");
  t = t.replace(/<\/?[^>]+>/g, (m) => (m.toLowerCase().includes("<br") ? "\n" : "")); // strip XML-ish
  t = t.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  return t;
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function callOpenRouter(model: string, messages: ORMessage[], signal?: AbortSignal): Promise<string> {
  const apiKey =
    (typeof process !== "undefined" && (process.env as any)?.OPENROUTER_API_KEY) ||
    (globalThis as any).OPENROUTER_API_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey || ""}`,
    "X-Title": "Where’s My Stipend – Resume Chat",
  };

  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      headers["HTTP-Referer"] = window.location.origin;
    }
  } catch {}

  const body = {
    model,
    messages,
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 420,
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as ORResponse;
  const out = data?.choices?.[0]?.message?.content || "";
  return sanitize(out);
}

/** Main entry used by the component. Tries your free models in priority order. */
export async function chatWithAssistant(
  message: string,
  profile: ChatProfile,
  history: ChatHistoryItem[] = [],
  opts?: { model?: FreeModel; signal?: AbortSignal }
): Promise<string> {
  const messages = buildMessages(message, profile, history);
  const order: string[] = opts?.model ? [opts.model, ...FREE_MODELS.filter(m => m !== opts.model)] : [...FREE_MODELS];

  let lastErr: unknown = null;

  for (const model of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callOpenRouter(model, messages, opts?.signal);
      } catch (err: any) {
        lastErr = err;
        const msg = ("" + (err?.message || err)).toLowerCase();
        const transient = /429|5\d\d|temporarily|timeout|rate limit|overloaded/.test(msg);
        if (!transient) break;
        await delay(300 * (attempt + 1));
      }
    }
  }

  console.error("OpenRouter failed through all free models:", lastErr);
  return "😕 I couldn’t reach the AI right now. Try again in a moment!";
}

export type { ChatHistoryItem as HistoryItem, ChatProfile as Profile };
