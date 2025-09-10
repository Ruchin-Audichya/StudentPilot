export function sanitizeAndShapeReply(input: string): string {
  let text = input || "";
  // Remove <think>...</think>
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Remove analysis/AI SUGGESTION sections
  text = text.replace(/^analysis.*$/gim, "");
  text = text.replace(/^ai\s*suggestion.*$/gim, "");
  // Remove repeated SUMMARY headers
  text = text.replace(/^(SUMMARY:)+/gi, "SUMMARY:");
  // Normalize excessive blank lines but keep paragraph spacing
  text = text.replace(/\n{3,}/g, "\n\n");
  // Clean up stray double spaces at EOL
  text = text.replace(/[ \t]+\n/g, "\n");
  // Split long paragraphs into bullets
  text = text.replace(/([^\n]{320,})/g, (m) => {
    return m.split(/(?<=\.|\!|\?)\s+/).map(s => s.trim() ? `- ${s.trim()}` : "").join("\n");
  });
  // If it's clearly a rating-only output like "8/10", return as-is
  if (/^\s*\d{1,2}\s*\/\s*10\s*$/m.test(text.trim())) {
    return text.trim();
  }
  // Limit to ~220 words unless user asked long; the server already hints length, this is a guard
  const words = text.split(/\s+/);
  if (words.length > 220) {
    let count = 0, out = [];
    for (const line of text.split("\n")) {
      const lineWords = line.split(/\s+/).length;
      if (count + lineWords > 200) break;
      out.push(line);
      count += lineWords;
    }
    text = out.join("\n") + "\n…";
  }
  // Emoji prefixing
  text = text.split("\n").map(line => {
    if (/^(\s*-\s*)?(strength|pro|good|positive|advantage)/i.test(line) && !line.includes("✅")) return "✅ " + line;
    if (/^(\s*-\s*)?(fix|improve|tip|suggest|advice|todo|next|step|improvement)/i.test(line) && !line.match(/[🔧💡]/)) return "💡 " + line;
    if (/^(\s*-\s*)?(role|suggest|career|job|position|fit)/i.test(line) && !line.includes("🧭")) return "🧭 " + line;
    return line;
  }).join("\n");
  return text.trim();
}
