/**
 * Clean and shape AI replies:
 * - remove meta junk (SUMMARY, TRY, AI SUGGESTION, <think>)
 * - normalize into sections with emojis
 * - bulletize long paragraphs
 * - prefix bullets with emojis when possible
 * - cap length for readability
 */
export function sanitizeAndShapeReply(input: string): string {
  if (!input) return "";

  let text = input;

  // Remove <think>...</think> and meta lines
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/^\s*(SUMMARY:|TRY:|AI SUGGESTION:).*$/gim, "");
  text = text.replace(/\n{2,}/g, "\n");

  // Normalize section headers
  const map: Record<string, string> = {
    summary: "🎯 **Summary**",
    "skill gaps": "🕳️ **Skill Gaps**",
    gaps: "🕳️ **Skill Gaps**",
    improvements: "🔧 **Improvements**",
    pros: "✅ **Pros**",
    cons: "👎 **Cons**",
    rating: "⭐ **Rating**",
    tip: "💡 **Tip**",
  };
  for (const [k, v] of Object.entries(map)) {
    const re = new RegExp(`^${k}:?`, "gim");
    text = text.replace(re, `${v}\n`);
  }

  // If no bullets, split long lines into bullets
  if (!/^\s*-\s+/m.test(text)) {
    text = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => (s.trim() ? `- ${s.trim()}` : ""))
      .join("\n");
  }

  // Prefix heuristics
  text = text
    .split("\n")
    .map((l) => {
      const line = l.trim();
      if (!line.startsWith("-")) return line;
      const base = line.replace(/^-\s*/, "");
      if (/strength|good|advantage|pro/i.test(base)) return `- ✅ ${base}`;
      if (/fix|improve|step|todo|next|advice/i.test(base)) return `- 🔧 ${base}`;
      if (/gap|weak|miss|lack|cons?/i.test(base)) return `- 👎 ${base}`;
      if (/role|career|job|position|fit/i.test(base)) return `- 🧭 ${base}`;
      if (/tip|hint|recommend/i.test(base)) return `- 💡 ${base}`;
      return `- ${base}`;
    })
    .join("\n");

  // Cap ~200 words
  const words = text.split(/\s+/);
  if (words.length > 200) {
    text = words.slice(0, 200).join(" ") + "\n…";
  }

  return text.trim();
}
