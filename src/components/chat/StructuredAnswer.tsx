import React, { useMemo } from "react";
import MarkdownMessage from "../MarkdownMessage";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type SectionKey = "summary" | "gaps" | "fixes" | "roles" | "extras" | "tip";

const order: SectionKey[] = ["summary", "gaps", "fixes", "roles", "extras", "tip"];
const titles: Record<SectionKey, string> = {
  summary: "🎯 Summary",
  gaps: "🧩 Skill Gaps",
  fixes: "🔥 Top 3 Fixes",
  roles: "💼 Roles & Keywords",
  extras: "📌 Extras",
  tip: "💡 Tip",
};

function splitSections(text: string) {
  const lines = (text || "").split(/\r?\n/);
  const sections: Partial<Record<SectionKey, string[]>> = {};
  let current: SectionKey | null = null;
  const matchKey = (h: string): SectionKey | null => {
    const hl = h.trim().toLowerCase();
    if (hl.startsWith("🎯")) return "summary";
    if (hl.startsWith("🧩")) return "gaps";
    if (hl.startsWith("🔥")) return "fixes";
    if (hl.startsWith("💼")) return "roles";
    if (hl.startsWith("📌")) return "extras";
    if (hl.startsWith("💡")) return "tip";
    return null;
  };
  for (const line of lines) {
    const key = matchKey(line);
    if (key) {
      current = key;
      sections[current] = sections[current] || [];
      continue;
    }
    if (current) {
      (sections[current] as string[]).push(line);
    }
  }
  return sections;
}

export default function StructuredAnswer({ text }: { text: string }) {
  const sections = useMemo(() => splitSections(text), [text]);

  // Determine if the text is structured; if not, just render raw
  const hasAny = order.some((k) => (sections[k]?.join("\n").trim().length || 0) > 0);
  if (!hasAny) {
    return (
      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[15px] leading-relaxed">
        <MarkdownMessage text={text} />
      </div>
    );
  }

  const copy = (s: string) => navigator?.clipboard?.writeText(s).catch(() => {});

  return (
    <div className="space-y-2">
      <Accordion type="multiple" className="[&>*]:bg-white/5 [&>*]:rounded-xl [&_*]:border-white/10">
        {order.filter((k)=>k!=="tip").map((k) => {
          const body = (sections[k] || []).join("\n").trim();
          if (!body) return null;
          return (
            <AccordionItem key={k} value={k} className="border border-white/10">
              <AccordionTrigger className="px-3 py-2 text-left text-[14px] md:text-[15px]">
                {titles[k]}
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-3 pb-3">
                  <div className="text-[14px] md:text-[15px]">
                    <MarkdownMessage text={body} />
                  </div>
                  <div className="mt-2 text-right">
                    <button className="wm-pill px-3 py-1.5 text-xs" onClick={() => copy(`${titles[k]}\n${body}`)}>Copy 📋</button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      {sections.tip && sections.tip.join("\n").trim() && (
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[14px] md:text-[15px]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold mb-1">{titles.tip}</div>
              <div className="whitespace-pre-wrap">{sections.tip.join("\n").trim()}</div>
            </div>
            <button className="wm-pill px-3 py-1.5 text-xs self-start" onClick={() => copy(`${titles.tip}\n${sections.tip?.join("\n").trim()}`)}>Copy 📋</button>
          </div>
        </div>
      )}
    </div>
  );
}
