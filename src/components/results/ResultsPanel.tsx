import React from "react";
import InternshipCard from "../InternshipCard";
import GapList from "./GapList";
import ProjectIdeaCard from "./ProjectIdeaCard";

interface ResultsPanelProps {
  result?: {
    type: "internships" | "skill_gap" | "projects";
    items?: any[];
    gaps?: any[];
    plan?: any[];
  };
  onSaveInternship?: (item: any) => void;
}

const typeHeadings: Record<string, string> = {
  internships: "Internship Suggestions",
  skill_gap: "Skill Gap Analysis",
  projects: "Project Ideas"
};

const ResultsPanel: React.FC<ResultsPanelProps> = ({ result, onSaveInternship }) => {
  if (!result) {
    return <section className="results-panel"><div className="text-xs opacity-60">No structured result yet.</div></section>;
  }
  const heading = typeHeadings[result.type] || "Results";

  return (
    <section className="results-panel p-4 rounded-2xl bg-white/5 shadow-md">
      <div className="font-bold text-lg mb-3">{heading}</div>
      {result.type === "internships" && result.items && (
        <div className="space-y-3">
          {result.items.map((item, i) => (
            <InternshipCard key={i} item={item} onSave={onSaveInternship} />
          ))}
        </div>
      )}
      {result.type === "skill_gap" && (
        <GapList gaps={result.gaps || []} plan={result.plan || []} />
      )}
      {result.type === "projects" && result.items && (
        <div className="space-y-3">
          {result.items.map((item, i) => (
            <ProjectIdeaCard key={i} item={item} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ResultsPanel;
