import { ReactNode } from "react";

export type Segment = { key: string; label: ReactNode };

type Props = {
  value: string;
  segments: Segment[];
  onChange: (key: string) => void;
  className?: string;
};

export default function SegmentedToggle({ value, segments, onChange, className }: Props) {
  return (
    <div className={`rounded-full border border-card-border bg-white/5 p-1 inline-flex shadow-sm ${className || ""}`}>
      {segments.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          aria-pressed={value === s.key}
          className={`px-3 py-1.5 rounded-full text-sm transition ${value === s.key ? "bg-white text-black shadow" : "text-muted-foreground hover:text-foreground"}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
