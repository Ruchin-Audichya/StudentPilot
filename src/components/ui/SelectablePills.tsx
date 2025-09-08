import React, { useMemo, useState } from "react";

type SelectablePillsProps = {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
  placeholder?: string;
  label?: string;
  max?: number;
  size?: "sm" | "md";
  className?: string;
};

/**
 * A lightweight, reusable multi-select pills control.
 * - Click pills to toggle selection
 * - Optional quick-add text input for custom items (Enter or comma)
 */
const SelectablePills: React.FC<SelectablePillsProps> = ({
  options,
  selected,
  onChange,
  allowCustom = true,
  placeholder = "Type and press Enter…",
  label,
  max,
  size = "md",
  className,
}) => {
  const [draft, setDraft] = useState("");

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((o) => {
      const k = o.trim();
      if (!k || seen.has(k.toLowerCase())) return false;
      seen.add(k.toLowerCase());
      return true;
    });
  }, [options]);

  function toggle(item: string) {
    const v = item.trim();
    if (!v) return;
    const has = selected.some((s) => s.toLowerCase() === v.toLowerCase());
    let next = has
      ? selected.filter((s) => s.toLowerCase() !== v.toLowerCase())
      : [...selected, v];
    if (max && next.length > max) next = next.slice(0, max);
    onChange(next);
  }

  function addCustomFromDraft() {
    const parts = draft
      .split(/,|\n/) // commas or newlines
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    let next = [...selected];
    for (const p of parts) {
      if (!next.some((s) => s.toLowerCase() === p.toLowerCase())) {
        next.push(p);
      }
    }
    if (max && next.length > max) next = next.slice(0, max);
    onChange(next);
    setDraft("");
  }

  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold">{label}</label>
          {max ? (
            <span className="text-xs text-muted-foreground">
              {selected.length}/{max}
            </span>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {normalizedOptions.map((opt) => {
          const active = selected.some((s) => s.toLowerCase() === opt.toLowerCase());
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(opt)}
              className={`wm-pill ${pad} ${active ? "active" : ""}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {allowCustom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomFromDraft();
              }
            }}
            placeholder={placeholder}
            className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <button type="button" className={`wm-pill ${pad}`} onClick={addCustomFromDraft}>
            Add
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((s) => (
            <span key={s} className={`wm-pill ${pad} active flex items-center gap-1`}>
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => toggle(s)}
                className="ml-1 text-[11px] opacity-80 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default SelectablePills;
