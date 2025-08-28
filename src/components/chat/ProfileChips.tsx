import React from "react";

interface ProfileChipsProps {
  skills: string[];
  year?: string;
}

const ProfileChips: React.FC<ProfileChipsProps> = ({ skills, year }) => {
  const chips: string[] = [];
  if (year) chips.push(year);
  chips.push(...skills.slice(0, 5));
  return (
    <div className="flex flex-wrap gap-1">
      {chips.slice(0, 6).map((chip, i) => (
        <span
          key={chip + i}
          className="wm-pill text-xs px-2 py-1 rounded-full bg-white/10 border border-white/20 text-white/80"
          style={{ fontSize: "0.85em", fontWeight: 500 }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
};

export default ProfileChips;
