import React from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showMoreSkills, setShowMoreSkills] = React.useState(false);
  const [showMoreInterests, setShowMoreInterests] = React.useState(false);
  const [skillsQuery, setSkillsQuery] = React.useState("");
  const [interestsQuery, setInterestsQuery] = React.useState("");

  const filteredSkillsOptions = React.useMemo(() => {
    const q = skillsQuery.trim().toLowerCase();
    if (!q) return RECOMMENDED_SKILLS;
    return RECOMMENDED_SKILLS.filter((s) => s.toLowerCase().includes(q));
  }, [skillsQuery]);

  const filteredInterestOptions = React.useMemo(() => {
    const q = interestsQuery.trim().toLowerCase();
    if (!q) return RECOMMENDED_INTERESTS;
    return RECOMMENDED_INTERESTS.filter((s) => s.toLowerCase().includes(q));
  }, [interestsQuery]);

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
            {/* Quick toggles: compact + calm */}
            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
              <button
                type="button"
                aria-pressed={onlyPaid}
                onClick={() => setOnlyPaid(!onlyPaid)}
                className={`wm-pill px-3 py-1.5 ${onlyPaid ? 'bg-white/20 border-white/30' : ''}`}
              >
                Paid only
              </button>
              <button
                type="button"
                aria-pressed={onlyNew}
                onClick={() => setOnlyNew(!onlyNew)}
                className={`wm-pill px-3 py-1.5 ${onlyNew ? 'bg-white/20 border-white/30' : ''}`}
              >
                New only
              </button>
              {onClear && (
                <button onClick={onClear} className="wm-pill px-3 py-1.5">Clear</button>
              )}
              {!!suggestedSkills.length && onUseFromResume && (
                <button onClick={onUseFromResume} className="wm-pill px-3 py-1.5">Use from resume</button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="wm-pill px-3 py-1.5"
                aria-expanded={showAdvanced}
              >
                {showAdvanced ? 'Hide options ▲' : 'More options ▼'}
              </button>
            </div>

            {/* Advanced options: revealed on demand */}
            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 md:p-4 mb-4"
                >
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={autoSearch} onChange={(e)=>setAutoSearch(e.target.checked)} />
                      Auto search
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                <div className="mb-2">
                  <label className="block text-sm font-semibold mb-1">Skills</label>
                  <input
                    type="text"
                    value={skillsQuery}
                    onChange={(e) => setSkillsQuery(e.target.value)}
                    placeholder="Filter skills…"
                    className="bg-input/50 border border-card-border rounded-full px-3 py-1.5 w-full text-sm"
                  />
                </div>
                <div className="relative" style={{ maxHeight: showMoreSkills ? "none" : 180, overflow: showMoreSkills ? "visible" : "hidden" }}>
                  <SelectablePills
                    // label handled above
                    options={filteredSkillsOptions}
                    selected={skills}
                    onChange={setSkills}
                    placeholder="Type to add skills…"
                  />
                  {!showMoreSkills && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
                  )}
                </div>
                <div className="mt-2 text-right">
                  <button className="text-xs underline decoration-dotted opacity-80 hover:opacity-100" onClick={() => setShowMoreSkills(!showMoreSkills)}>
                    {showMoreSkills ? "Show less" : "Show more"}
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label className="block text-sm font-semibold mb-1">Interests</label>
                  <input
                    type="text"
                    value={interestsQuery}
                    onChange={(e) => setInterestsQuery(e.target.value)}
                    placeholder="Filter interests…"
                    className="bg-input/50 border border-card-border rounded-full px-3 py-1.5 w-full text-sm"
                  />
                </div>
                <div className="relative" style={{ maxHeight: showMoreInterests ? "none" : 180, overflow: showMoreInterests ? "visible" : "hidden" }}>
                  <SelectablePills
                    // label handled above
                    options={filteredInterestOptions}
                    selected={interests}
                    onChange={setInterests}
                    placeholder="Type to add interests…"
                  />
                  {!showMoreInterests && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
                  )}
                </div>
                <div className="mt-2 text-right">
                  <button className="text-xs underline decoration-dotted opacity-80 hover:opacity-100" onClick={() => setShowMoreInterests(!showMoreInterests)}>
                    {showMoreInterests ? "Show less" : "Show more"}
                  </button>
                </div>
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
