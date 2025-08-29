import React from "react";

interface Internship {
  title: string;
  company: string;
  location?: string;
  skills?: string[];
  whyFit?: string;
}

interface InternshipCardProps {
  item: Internship;
  onSave?: (item: Internship) => void;
}

const InternshipCard: React.FC<InternshipCardProps> = ({ item, onSave }) => (
  <div className="internship-card glass p-4 rounded-2xl shadow-md mb-3">
    <div className="font-bold text-lg mb-1">{item.title}</div>
    <div className="text-slate-300 mb-1">{item.company}{item.location && ` • ${item.location}`}</div>
    {item.skills && (
      <div className="mb-1">
        <span className="font-semibold">Skills:</span>
        <span className="ml-1 text-xs text-slate-400">{item.skills.join(", ")}</span>
      </div>
    )}
    {item.whyFit && (
      <div className="mb-1">
        <span className="font-semibold">Why Fit:</span>
        <span className="ml-1 text-xs text-slate-400 italic">{item.whyFit}</span>
      </div>
    )}
    {onSave && (
      <button
        className="mt-2 px-3 py-1 text-xs bg-indigo-600/20 rounded-full border border-indigo-400/30 text-indigo-200 hover:bg-indigo-600/40"
        onClick={() => onSave(item)}
      >
        Save
      </button>
    )}
  </div>
);

export default InternshipCard;
