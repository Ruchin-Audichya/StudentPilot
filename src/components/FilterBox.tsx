import React from "react";
import SelectablePills from "@/components/ui/SelectablePills";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RECOMMENDED_INTERESTS, RECOMMENDED_SKILLS } from "@/constants/recommendations";

type SortBy = "scoreDesc" | "source" | "recent";

type Props = {
  skills: string[];
  setSkills: (v: string[]) => void;
  interests: string[];
  setInterests: (v: string[]) => void;
  location: string;
  setLocation: (s: string) => void;
  suggestedSkills?: string[];
  onUseFromResume?: () => void;
  onClear?: () => void;
  onlyPaid: boolean;
  setOnlyPaid: (b: boolean) => void;
  onlyNew: boolean;
  setOnlyNew: (b: boolean) => void;
  minScore: number;
  setMinScore: (n: number) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  autoSearch: boolean;
  setAutoSearch: (b: boolean) => void;
  onSearch: () => void;
  loading?: boolean;
};

const FilterBox: React.FC<Props> = ({
  skills, setSkills,
  interests, setInterests,
  location, setLocation,
  suggestedSkills = [], onUseFromResume, onClear,
  onlyPaid, setOnlyPaid,
  onlyNew, setOnlyNew,
  minScore, setMinScore,
  sortBy, setSortBy,
  autoSearch, setAutoSearch,
  onSearch,
  loading = false,
}) => {
  return (
    <div className="glass-card rounded-3xl p-5 md:p-6 shadow-lg hover:shadow-xl transition-shadow animate-slide-up hover-lift">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="flex items-center gap-2">
          <button onClick={onSearch} disabled={loading} className={`btn btn-success hover-lift ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Searching…
              </span>
            ) : 'Search'}
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="mt-2 text-xs text-muted-foreground">
        {skills.length > 0 ? `${skills.length} skill${skills.length>1?"s":""}` : "No skills"}
        {" · "}
        {interests.length > 0 ? `${interests.length} interest${interests.length>1?"s":""}` : "No interests"}
        {" · "}Location: {location || "—"}
      </div>

      <Accordion type="single" collapsible defaultValue="open" className="mt-3">
        <AccordionItem value="open" className="border-none">
          <AccordionTrigger className="rounded-xl px-3 py-2 bg-white/5 border border-card-border">
            Adjust filters
          </AccordionTrigger>
          <AccordionContent>
            {/* Quick actions */}
            <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoSearch} onChange={(e)=>setAutoSearch(e.target.checked)} />
                Auto search
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyPaid} onChange={(e)=>setOnlyPaid(e.target.checked)} />
                Paid only
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyNew} onChange={(e)=>setOnlyNew(e.target.checked)} />
                New only
              </label>
              <div className="flex items-center gap-2">
                <span>Min relevance</span>
                <input type="range" min={0} max={100} value={minScore} onChange={(e)=>setMinScore(Number(e.target.value))} />
                <span>{minScore}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Sort</span>
                <select className="bg-input/50 border border-card-border rounded-full px-2 py-1" value={sortBy} onChange={(e)=>setSortBy(e.target.value as SortBy)}>
                  <option value="scoreDesc">Best match</option>
                  <option value="source">Source</option>
                  <option value="recent">Recent</option>
                </select>
              </div>
              {onClear && <button onClick={onClear} className="wm-pill px-3 py-1.5">Clear</button>}
              {!!suggestedSkills.length && onUseFromResume && (
                <button onClick={onUseFromResume} className="wm-pill px-3 py-1.5">Use from resume</button>
              )}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                {!!suggestedSkills.length && (
                  <SelectablePills
                    label="From your resume"
                    options={suggestedSkills}
                    selected={skills}
                    onChange={setSkills}
                    allowCustom={false}
                    size="sm"
                  />
                )}
                <SelectablePills
                  label="Skills"
                  options={RECOMMENDED_SKILLS}
                  selected={skills}
                  onChange={setSkills}
                  placeholder="Type to add skills…"
                />
              </div>
              <div>
                <SelectablePills
                  label="Interests"
                  options={RECOMMENDED_INTERESTS}
                  selected={interests}
                  onChange={setInterests}
                  placeholder="Type to add interests…"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Location</label>
                <input
                  type="text"
                  placeholder="📍 Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default FilterBox;
