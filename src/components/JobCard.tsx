import { memo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { JobResult } from "@/services/jobApi";

type Props = { job: JobResult };

// Color helper for simple text tags
function tagColor(tag: string) {
  const t = tag.toLowerCase();
  if (t.includes("remote")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (t.includes("hybrid")) return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (t.includes("onsite") || t.includes("on-site")) return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  return "bg-white/5 text-foreground border-card-border";
}

export default memo(function JobCard({ job }: Props) {
  const hot = Array.isArray((job as any).tags)
    ? ((job as any).tags as string[]).some((t) => (t || "").toLowerCase().includes("🔥 hot"))
    : Array.isArray(job.required_skills)
      ? job.required_skills.some((t) => (t || "").toLowerCase().includes("🔥 hot"))
      : false;

  const tagList: string[] = [];
  // Derive simple tags if present in the description or skills
  const hay = `${job.description || ""} ${(job.required_skills || []).join(" ")}`.toLowerCase();
  if (hay.includes("remote")) tagList.push("remote");
  if (hay.includes("hybrid")) tagList.push("hybrid");
  if (hay.includes("onsite") || hay.includes("on-site")) tagList.push("onsite");

  const applyHref = (job.url || (job as any).apply_url || (job as any).applyUrl || "").toString();
  const missing: string[] | undefined = (job as any).missing_keywords;

  return (
    <motion.div
      className="relative glass-card rounded-2xl p-5 group h-full flex flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      whileTap={{ y: -1 }}
    >
      {/* Hot badge (top-left) */}
      {hot && (
        <span className="absolute -top-2 -left-2 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 shadow-sm">
          🔥 Hot
        </span>
      )}
      {/* New badge (top-right) */}
      {job.is_new && (
        <span className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
          🆕 New
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base md:text-lg font-bold">{job.title}</h3>
          <p className="text-sm text-muted-foreground">
            {job.company} • {job.location}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-white/5 border border-card-border">{job.source}</span>
      </div>

      {job.stipend && (
        <p className="mt-2 text-sm">
          Stipend: <span className="font-semibold text-purple-300">{job.stipend}</span>
        </p>
      )}

      {job.description && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-3 min-h-[3.6em]">{job.description}</p>
      )}

      {/* Match score */}
      {typeof job.score === "number" && job.score >= 0 && job.score <= 100 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Match</span>
            <span className="font-medium text-foreground">{Math.round(job.score)}%</span>
          </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(16,185,129,.45)]"
              style={{ width: `${Math.max(0, Math.min(100, job.score))}%` }}
            />
          </div>
        </div>
      )}

      {job.required_skills && job.required_skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {job.required_skills.slice(0, 6).map((t, i) => (
            <span
              key={i}
              className={`text-xs px-3 py-1 rounded-full border transition group-hover:bg-white/10 ${tagColor(t)}`}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Top missing keywords from analyzer */}
      {missing && missing.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {missing.slice(0, 4).map((t, i) => (
            <span
              key={`mk-${i}`}
              className="text-[11px] px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-300 border-rose-500/30"
              title="Add to resume to improve ATS"
            >
              + {t}
            </span>
          ))}
        </div>
      )}

      {/* Derived simple tags */}
      {tagList.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tagList.map((t, i) => (
            <span key={`dt-${i}`} className={`text-[11px] px-2 py-0.5 rounded-full border ${tagColor(t)}`}>
              {t}
            </span>
          ))}
          {job.stipend && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border bg-purple-500/15 text-purple-300 border-purple-500/30">
              stipend
            </span>
          )}
        </div>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between">
        <Button asChild className="gradient-primary text-white">
          <a href={applyHref || "#"} target="_blank" rel="noopener noreferrer">Apply Now</a>
        </Button>
        <button
          onClick={() => applyHref && window.open(applyHref, "_blank")}
          className="text-sm px-3 py-1 rounded-full bg-white/5 border border-card-border hover:bg-white/10 transition"
        >
          Details
        </button>
      </div>
    </motion.div>
  );
});
