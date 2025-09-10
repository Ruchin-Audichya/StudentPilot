// services/chatApi.ts
// OpenRouter chat client wired to your free models, resume-aware, concise, emoji formatting.

import { API_BASE } from "@/lib/apiBase";
import { sanitizeAndShapeReply } from "@/utils/chatFormat";

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

/** Single free model selection */
const FREE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
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

/** Main entry used by the component. Tries your free models in priority order. */
export async function chatWithAssistant(
  message: string,
  selectedModel?: string,
  opts?: { signal?: AbortSignal; idToken?: string }
): Promise<string> {
  const sid = (()=>{ try{ return localStorage.getItem('wm.session.v1') || (localStorage.setItem('wm.session.v1', crypto.randomUUID()), localStorage.getItem('wm.session.v1')); } catch { return null; } })();
  const body = {
    message,
    session_id: sid || undefined,
    model: (selectedModel || "deepseek/deepseek-chat-v3-0324:free").trim()
  };
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(sid ? { 'X-Session-Id': sid } : {}) };
  if (opts?.idToken) headers["id_token"] = opts.idToken;
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: opts?.signal
    });
    if (!res.ok) throw new Error(`⚠️ Chat request failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    let reply = data.response || data.choices?.[0]?.message?.content || "No response";
    return sanitizeAndShapeReply(reply);
  } catch (err) {
    return `⚠️ Chat request failed: ${err}`;
  }
}

export async function chatCompletion({ message, selectedModel, idToken }: {
  message: string;
  selectedModel?: string;
  idToken?: string;
}) {
  const sid = (()=>{ try{ return localStorage.getItem('wm.session.v1') || (localStorage.setItem('wm.session.v1', crypto.randomUUID()), localStorage.getItem('wm.session.v1')); } catch { return null; } })();
  const body = {
    message,
    session_id: sid || undefined,
    model: (selectedModel || "deepseek/deepseek-chat-v3-0324:free").trim()
  };
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(sid ? { 'X-Session-Id': sid } : {}) };
  if (idToken) headers["id_token"] = idToken;
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`⚠️ Chat request failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    let reply = data.response || data.choices?.[0]?.message?.content || "No response";
    return sanitizeAndShapeReply(reply);
  } catch (err) {
    return `⚠️ Chat request failed: ${err}`;
  }
}

export type { ChatHistoryItem as HistoryItem, ChatProfile as Profile };
