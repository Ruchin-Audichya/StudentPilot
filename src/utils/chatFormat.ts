export function sanitizeAndShapeReply(input: string): string {
  let text = input || "";
  // Remove <think>...</think>
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Remove analysis/AI SUGGESTION sections
  text = text.replace(/^analysis.*$/gim, "");
  text = text.replace(/^ai\s*suggestion.*$/gim, "");
  // Remove repeated SUMMARY headers
  text = text.replace(/^(SUMMARY:)+/gi, "SUMMARY:");
  // Collapse blank lines
  text = text.replace(/\n{2,}/g, "\n");
  // Split long paragraphs into bullets
  text = text.replace(/([^\n]{240,})/g, (m) => {
    return m.split(/(?<=\.|\!|\?)\s+/).map(s => s.trim() ? `- ${s.trim()}` : "").join("\n");
  });
  // Limit to ~200 words
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
