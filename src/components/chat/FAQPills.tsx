import React from "react";

interface FAQPillsProps {
  items: string[];
  onPick: (q: string) => void;
}

const FAQPills: React.FC<FAQPillsProps> = ({ items, onPick }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((q) => (
      <button
        key={q}
        onClick={() => onPick(q)}
        className="wm-pill text-xs sm:text-[13px] px-3 py-1.5"
      >
        {q}
      </button>
    ))}
  </div>
);

export default FAQPills;
