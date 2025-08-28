import React from "react";

interface ResumeBadgeProps {
  uploaded: boolean;
}

const ResumeBadge: React.FC<ResumeBadgeProps> = ({ uploaded }) => (
  <span
    className={
      [
        "wm-pill text-xs px-2 py-1 rounded-full border",
        uploaded
          ? "bg-green-500/20 text-green-300 border-green-400/30"
          : "bg-amber-500/20 text-amber-300 border-amber-400/30"
      ].join(" ")
    }
    style={{ minWidth: 110, display: "inline-block", textAlign: "center" }}
  >
    {uploaded ? "Resume linked ✓" : "Resume missing ⚠"}
  </span>
);

export default ResumeBadge;
