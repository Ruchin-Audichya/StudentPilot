import React from "react";

interface ProjectIdea {
  title: string;
  problem: string;
  features: string[];
  tech: string[];
  stretch?: string[];
  value?: string;
}

interface ProjectIdeaCardProps {
  item: ProjectIdea;
}

const ProjectIdeaCard: React.FC<ProjectIdeaCardProps> = ({ item }) => (
  <div className="project-card glass p-4 rounded-2xl shadow-md mb-4">
    <div className="project-title font-bold text-lg mb-2">{item.title}</div>
    <div className="project-section mb-2">
      <div className="font-semibold mb-1">Problem</div>
      <p className="text-slate-300 mb-2">{item.problem}</p>
    </div>
    <div className="project-section mb-2">
      <div className="font-semibold mb-1">Features</div>
      <ul className="list-disc pl-5">
        {item.features.map((f, i) => (
          <li key={f + i} className="mb-1 text-slate-200">{f}</li>
        ))}
      </ul>
    </div>
    <div className="project-section mb-2">
      <div className="font-semibold mb-1">Tech Stack</div>
      <div className="flex flex-wrap gap-1">
        {item.tech.map((t) => (
          <span key={t} className="chip px-2 py-0.5 bg-indigo-600/20 text-xs rounded-full border border-indigo-400/30 text-indigo-200">
            {t}
          </span>
        ))}
      </div>
    </div>
    {item.stretch && item.stretch.length > 0 && (
      <div className="project-section mb-2">
        <div className="font-semibold mb-1">Stretch Goals</div>
        <ul className="list-disc pl-5">
          {item.stretch.map((s, i) => (
            <li key={s + i} className="mb-1 text-slate-400">{s}</li>
          ))}
        </ul>
      </div>
    )}
    {item.value && (
      <div className="project-section mb-2">
        <div className="font-semibold mb-1">Value</div>
        <p className="text-green-300 italic">{item.value}</p>
      </div>
    )}
  </div>
);

export default ProjectIdeaCard;
