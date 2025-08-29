import React from "react";

interface InternshipItem {
  title: string;
  company: string;
  location?: string;
  whyFit?: string;
  skills?: string[];
  apply?: string;
}

interface InternshipCardProps {
  item: InternshipItem;
  onSave?: (item: InternshipItem) => void;
}

const InternshipCard: React.FC<InternshipCardProps> = ({ item, onSave }) => {
  return (
    <div className="result-card glass p-4 rounded-2xl shadow-md mb-4">
      <div className="result-title font-bold text-lg mb-1">{item.title}</div>
      <div className="result-meta text-sm text-slate-300 mb-1">
        {item.company}
        {item.location && <> &middot; {item.location}</>}
      </div>
      {item.whyFit && (
        <div className="result-meta text-xs italic text-slate-400 mb-2">{item.whyFit}</div>
      )}
      {item.skills && item.skills.length > 0 && (
        <div className="result-list flex flex-wrap gap-1 mb-2">
          {item.skills.map((skill) => (
            <span key={skill} className="px-2 py-0.5 bg-white/10 text-xs rounded-full border border-white/15 text-slate-200">
              {skill}
            </span>
          ))}
        </div>
      )}
      <div className="result-footer flex items-center gap-3 mt-2">
        {item.apply && (
          <a
            href={item.apply}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 underline text-sm font-medium"
          >
            Apply
          </a>
        )}
        {onSave && (
          <button
            type="button"
            className="ml-auto px-3 py-1 text-xs rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
            onClick={() => onSave(item)}
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
};

export default InternshipCard;
