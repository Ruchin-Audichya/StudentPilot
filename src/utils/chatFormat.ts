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

  // Remove <think>...</think> and meta lines (robust)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Remove meta lines like SUMMARY:, TRY:, AI SUGGESTION: with leading dashes, spaces, mixed case
  text = text.replace(/^[\s\-]*((summary|try|ai suggestion)\s*:).*/gim, "");
  // Remove lines starting with analysis, assistantfinal, final, etc.
  text = text.replace(/^[\s\-]*(analysis|assistantfinal|final|reflection|reasoning|let'?s produce)\s*:?.*/gim, "");
  // Remove stray 'Let's produce' and similar phrases anywhere
  text = text.replace(/let'?s produce[\s\S]*?(?=\n|$)/gi, "");
  // Remove stray XML/meta tags
  text = text.replace(/<[^>]+>/g, "");
  // Collapse whitespace and repeated newlines
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{2,}/g, "\n");

  // Normalize section headers to capitalized short headings (not all caps, not code blocks)
  const headingMap: Record<string, string> = {
    summary: "Summary",
    "skill gaps": "Skill Gaps",
    gaps: "Skill Gaps",
    improvements: "Improvements",
    pros: "Pros",
    cons: "Cons",
    rating: "Rating",
    tip: "Tip",
    "next steps": "Next Steps"
  };
  for (const [k, v] of Object.entries(headingMap)) {
    // Match heading at start of line, with optional colon, mixed case
    const re = new RegExp(`^\s*${k.replace(/ /g, "[ _-]?")}:?`, "gim");
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
