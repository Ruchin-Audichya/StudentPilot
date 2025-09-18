import { useMemo, useState, useEffect, useRef } from "react";
import { API_BASE } from "@/lib/apiBase";
import { motion, AnimatePresence } from "framer-motion";
import ChatWidget from "./ChatWidget";
import { auth } from "@/lib/firebase";
import { searchInternships, JobResult } from "@/services/jobApi";
import { fetchGovFeeds } from "@/services/govApi";
import { analyzeResumeAgainstJobs, toAnalyzeJobInputs, AnalyzerResponse } from "@/services/analyzer";
import { fetchHRLinks } from "@/services/hrLinks";
import { fetchHRProfiles, HRProfileLink } from "@/services/hrProfiles";
import { fetchHRProfilesBatch, HRProfilesBatchItem } from "@/services/hrProfilesBatch";
import { generatePortfolioZip, downloadBlob } from "@/services/portfolio";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import JobCard from "@/components/JobCard";
import BackendDebug from "@/components/BackendDebug";
import "../App.css";
import FilterBox from "@/components/FilterBox";
import TopNav from "@/components/TopNav";

interface StudentProfile {
  name: string;
  college?: string;
  branch?: string;
  year?: string;
  skills: string[];
  interests: string[];
}

type DashboardProps = {
  profile?: StudentProfile;
};

export default function Dashboard({ profile }: DashboardProps) {
   const navigate = useNavigate(); // Initialize useNavigate hook
  // Stable client session id used to scope resume/chat per browser
  const sessionIdRef = useRef<string | null>(null);
  if (!sessionIdRef.current) {
    try {
      const key = "wm.session.v1";
      let sid = localStorage.getItem(key);
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem(key, sid);
      }
      sessionIdRef.current = sid;
    } catch {}
  }
  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem("onboarding") || "null") as StudentProfile | null;
    } catch {
      return null;
    }
  })();
  const effective = profile || stored || { name: "Friend", skills: [], interests: [] };

  const [skills, setSkills] = useState<string[]>(effective.skills || []);
  const [interests, setInterests] = useState<string[]>(effective.interests || []);
  const [location, setLocation] = useState<string>("India");
  const [results, setResults] = useState<JobResult[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [hrLoading, setHrLoading] = useState(false);
  const [hrLinks, setHrLinks] = useState<{ label: string; url: string }[]>([]);
  const [hrProfiles, setHrProfiles] = useState<HRProfileLink[]>([]);
  const [hrCompany, setHrCompany] = useState<string>("");
  const [hrBatch, setHrBatch] = useState<HRProfilesBatchItem[] | null>(null);
  const [generatingPortfolio, setGeneratingPortfolio] = useState(false);
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"scoreDesc" | "source" | "recent">("scoreDesc");
  const [autoSearch, setAutoSearch] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "ats" | "linkedin" | "internshala">("all");
  const [govOnly, setGovOnly] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>("Rajasthan");

  // Suggestions from parsed resume (if uploaded)
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [suggestedRoles, setSuggestedRoles] = useState<string[]>([]);
  const debounceRef = useRef<any>(null);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  // Backend health polling
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 25; // ~50s with 2s interval
    async function check() {
      if (cancelled) return;
      attempts++;
      try {
        let success = false;
        try {
          const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
          success = r.ok;
        } catch {}
        if (!success && /\/api\/backend$/.test(API_BASE)) {
          const alt = API_BASE.replace(/\/api\/backend$/, "");
          try {
            const r2 = await fetch(`${alt}/health`, { cache: "no-store" });
            success = r2.ok;
          } catch {}
        }
        if (!cancelled) {
          setBackendOk(success);
          if (!success && attempts < maxAttempts) setTimeout(check, 2000);
        }
      } catch {
        if (!cancelled) {
          setBackendOk(false);
          if (attempts < maxAttempts) setTimeout(check, 2000);
        }
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch resume-derived suggestions (skills/roles/location) to drive pills
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/resume-status`, {
          cache: "no-store",
          headers: sessionIdRef.current ? { "X-Session-Id": sessionIdRef.current } : undefined,
        });
        if (!r.ok) return;
        const d = await r.json();
        setSuggestedSkills(Array.isArray(d.skills) ? d.skills.slice(0, 12) : []);
        setSuggestedRoles(Array.isArray(d.roles) ? d.roles.slice(0, 6) : []);
        if (d.location && (!location || location === "India")) setLocation(d.location);
      } catch {}
    })();
  }, []);

  function manualRetryBackend() {
    setBackendOk(null);
    (async () => {
      try {
        let ok = false;
        try {
          const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
          ok = r.ok;
        } catch {}
        if (!ok && /\/api\/backend$/.test(API_BASE)) {
          const alt = API_BASE.replace(/\/api\/backend$/, "");
          try {
            const r2 = await fetch(`${alt}/health`, { cache: "no-store" });
            ok = r2.ok;
          } catch {}
        }
        setBackendOk(ok);
      } catch {
        setBackendOk(false);
      }
    })();
  }

  // Chatbot (legacy left here in case you still use it elsewhere)
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const firstName = useMemo(
    () => (effective?.name || "").split(" ")[0] || "there",
    [effective?.name]
  );

  const listVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  } as const;

  async function handleSearch() {
    setLoading(true);
    try {
      const jobs = govOnly
        ? await fetchGovFeeds({ state: stateFilter || undefined, only_verified: true, limit: 80 })
        : await searchInternships({ skills, interests, location });
      setResults(jobs);
      // Kick off analyzer in background if we have a resume in session
      setAnalyzing(true);
      try {
        const resp = await analyzeResumeAgainstJobs({ jobs: toAnalyzeJobInputs(jobs), use_ai: true });
        setAnalysis(resp);
      } catch (e) {
        console.warn("Analyzer failed", e);
      } finally {
        setAnalyzing(false);
      }
  // Fetch HR links in parallel
      setHrLoading(true);
      try {
        const resp = await fetchHRLinks({
          // Provide explicit filters when available; server will fallback to session resume
          skills: skills.length ? skills : undefined,
          roles: (suggestedRoles && suggestedRoles.length) ? suggestedRoles.slice(0, 3) : undefined,
          location: location || undefined,
          limit: 8,
        });
        // Backward compat: resp.links can be array of strings or objects
        const links = Array.isArray((resp as any).links)
          ? (resp as any).links.map((x: any, i: number) => (typeof x === 'string' ? { label: `HR search ${i+1}`, url: x } : x))
          : [];
        setHrLinks(links);
      } catch (e) {
        console.warn("HR links fetch failed", e);
      } finally {
        setHrLoading(false);
      }
      // Fetch HR profiles for notable companies in results (prefer ATS sources)
      try {
        const atsCompanies = Array.from(new Set(
          jobs
            .filter(j => (j.source||"").match(/lever|greenhouse|workday|smartrecruiters|company-careers|generic/i) && j.company)
            .map(j => j.company as string)
        ));
        if (atsCompanies.length > 1) {
          const items = await fetchHRProfilesBatch({ companies: atsCompanies.slice(0,4), roles: suggestedRoles.slice(0,2), location, skills: skills.slice(0,3), per_company_limit: 3 });
          setHrBatch(items);
          setHrProfiles([]);
          setHrCompany(atsCompanies[0] || "");
        } else {
          const preferred = jobs.find(j => (j.source||"").match(/lever|greenhouse|workday|smartrecruiters|company-careers|generic/i)) || jobs[0];
          if (preferred?.company) {
            const profs = await fetchHRProfiles({ company: preferred.company, roles: suggestedRoles.slice(0,2), location, skills: skills.slice(0,3), limit: 6 });
            setHrProfiles(profs);
            setHrCompany(preferred.company);
            setHrBatch(null);
          } else {
            setHrProfiles([]);
            setHrBatch(null);
          }
        }
      } catch (e) {
        console.warn("HR profiles fetch failed", e);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  }

  // Auto-search on change (debounced) for a smoother experience
  useEffect(() => {
    if (!autoSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSearch();
    }, 600);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, interests, location, autoSearch]);

  async function handleResumeUpload() {
    if (!resumeFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", resumeFile);
      const res = await fetch(`${API_BASE}/api/upload-resume`, {
        method: "POST",
        body: formData,
        headers: sessionIdRef.current ? { "X-Session-Id": sessionIdRef.current } : undefined,
      });
      const data = await res.json();
      console.log("Resume upload:", data);
      if (res.ok) setUploaded(true);
      // If we already have results, analyze them now
      if (res.ok && results.length > 0) {
        setAnalyzing(true);
        try {
          const resp = await analyzeResumeAgainstJobs({ jobs: toAnalyzeJobInputs(results), use_ai: true });
          setAnalysis(resp);
        } catch (e) {
          console.warn("Analyzer after upload failed", e);
        } finally {
          setAnalyzing(false);
        }
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  }

  async function sendMessage() {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", text: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionIdRef.current) headers["X-Session-Id"] = sessionIdRef.current;
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) headers["id_token"] = token;
      } catch {}

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers,
  body: JSON.stringify({ message: userMsg.text, session_id: sessionIdRef.current || undefined }),
      });
      const data = await res.json();
      const botMsg = { role: "bot", text: data.response || "No response" };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Chat failed", err);
    } finally {
      setChatLoading(false);
    }
  }

  // Derived client-side filtered/sorted view
  const derivedResults = useMemo(() => {
    let arr = results.slice();
    // Source filter first
    const isATS = (src?: string) => {
      const s = (src || "").toLowerCase();
      return ["lever","greenhouse","workday","smartrecruiters","company-careers","generic"].some(k => s.includes(k));
    };
    if (sourceFilter === "linkedin") arr = arr.filter(j => (j.source || "").toLowerCase().includes("linkedin"));
    else if (sourceFilter === "internshala") arr = arr.filter(j => (j.source || "").toLowerCase().includes("internshala"));
    else if (sourceFilter === "ats") arr = arr.filter(j => isATS(j.source));
    if (onlyPaid) arr = arr.filter((j) => !!(j.stipend && String(j.stipend).trim()));
    if (onlyNew) arr = arr.filter((j) => j.is_new);
    if (minScore > 0) arr = arr.filter((j) => (j.score ?? 0) >= minScore);
    if (sortBy === "scoreDesc") arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    else if (sortBy === "source") arr.sort((a, b) => (a.source || "").localeCompare(b.source || ""));
    // 'recent' is backend-dependent; keep original order as scraped
    return arr;
  }, [results, sourceFilter, onlyPaid, onlyNew, minScore, sortBy]);

  // Source counts for quick breakdown label
  const sourceCounts = useMemo(() => {
    const counts = { linkedin: 0, internshala: 0, ats: 0 };
    const isATS = (src?: string) => {
      const s = (src || "").toLowerCase();
      return ["lever","greenhouse","workday","smartrecruiters","company-careers","generic"].some(k => s.includes(k));
    };
    for (const j of results) {
      const s = (j.source || "").toLowerCase();
      if (s.includes("linkedin")) counts.linkedin++;
      else if (s.includes("internshala")) counts.internshala++;
      else if (isATS(s)) counts.ats++;
    }
    return counts;
  }, [results]);

  function useTopFromResume() {
    const top = suggestedSkills.slice(0, 5);
    const merged = Array.from(new Set([...skills, ...top]));
    setSkills(merged);
  }

  function clearAll() {
    setSkills([]);
    setInterests([]);
  }

  function renderFormatted(text: string) {
    const blocks = text.split(/\n\n+/);
    return (
      <div className="space-y-2">
        {blocks.map((block, i) => {
          const lines = block.split(/\n/);
          const isList = lines.every((l) => l.trim().startsWith("-") || l.trim() === "");
          if (isList) {
            return (
              <ul key={i} className="list-disc pl-5 space-y-1">
                {lines
                  .filter((l) => l.trim().startsWith("-"))
                  .map((l, idx) => <li key={idx}>{l.replace(/^\s*-\s*/, "")}</li>)}
              </ul>
            );
          }
          return <p key={i}>{block}</p>;
        })}
      </div>
    );
  }

  return (
  <div className="min-h-screen overflow-x-hidden">
      <TopNav
        actions={[
          { label: "🎙️ Mock Interview", to: "/mock-interview" },
          { label: "🧠 Resume Genius", to: "/resume-genius" },
          { label: "Logout", to: "/logout" },
        ]}
      />
      <div className="p-4 md:p-8">
      <div className="mb-4 hidden sm:block">
        <BackendDebug />
      </div>

      <div className="text-xs mb-2">
        Backend:{" "}
        {backendOk === null ? (
          "checking…"
        ) : backendOk ? (
          "online ✅"
        ) : (
          <span
            className="cursor-pointer underline decoration-dotted"
            title="Click to retry"
            onClick={manualRetryBackend}
          >
            offline ❌ (retry)
          </span>
        )}
      </div>

      {/* Greeting */}
      <header className="mb-8 animate-fade-in">
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Hi, {firstName} 👋
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Let’s help you land your dream internship.
          </p>
        </div>
      </header>

      {/* Main content layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resume uploader */}
          <div className="glass-card rounded-2xl p-5 md:p-6 animate-fade-in hover-lift">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-left">
                <h2 className="text-lg font-semibold">Upload Resume</h2>
                <p className="text-sm text-muted-foreground">
                  We’ll use it to refine matches and chat context.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:text-white file:px-4 file:py-2 file:hover:bg-white/20 file:cursor-pointer w-full sm:w-auto"
                />
                <button
                  onClick={handleResumeUpload}
                  disabled={!resumeFile || uploading}
                  className={`btn ${uploaded ? 'btn-success' : 'btn-primary'} hover-lift`}
                >
                  {uploading ? "Uploading..." : uploaded ? "Uploaded • Replace" : "Upload"}
                </button>
              </div>
            </div>
          </div>

          {/* Search panel */}
          <FilterBox
            skills={skills}
            setSkills={setSkills}
            interests={interests}
            setInterests={setInterests}
            location={location}
            setLocation={setLocation}
            govOnly={govOnly}
            setGovOnly={setGovOnly}
            stateFilter={stateFilter}
            setStateFilter={setStateFilter}
            suggestedSkills={suggestedSkills}
            onUseFromResume={useTopFromResume}
            onClear={clearAll}
            onlyPaid={onlyPaid}
            setOnlyPaid={setOnlyPaid}
            onlyNew={onlyNew}
            setOnlyNew={setOnlyNew}
            minScore={minScore}
            setMinScore={setMinScore}
            sortBy={sortBy}
            setSortBy={setSortBy}
            autoSearch={autoSearch}
            setAutoSearch={setAutoSearch}
            onSearch={handleSearch}
            loading={loading}
          />
            {/* chips */}
            <motion.div layout className="mt-3 flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {skills.map((s, i) => (
                  <motion.span
                    layout
                    key={`sk-${s}-${i}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-xs px-3 py-1 rounded-full bg-white/5 border border-card-border shadow-sm hover:shadow transition"
                  >
                    {s}
                  </motion.span>
                ))}
                {interests.map((s, i) => (
                  <motion.span
                    layout
                    key={`in-${s}-${i}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-xs px-3 py-1 rounded-full bg-white/5 border border-card-border shadow-sm hover:shadow transition"
                  >
                    {s}
                  </motion.span>
                ))}
              </AnimatePresence>
            </motion.div>
          {/* Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Results
                {loading && (
                  <span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Searching…
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {loading ? '-' : `${derivedResults.length} matches`}
                </span>
                <div className="text-[11px] text-muted-foreground">
                  <span className="mr-2">Sources:</span>
                  <span className="mr-2">LinkedIn {sourceCounts.linkedin}</span>
                  <span className="mr-2">ATS {sourceCounts.ats}</span>
                  <span>Internshala {sourceCounts.internshala}</span>
                </div>
                <div className="flex items-center gap-1">
                  {(["all","ats","linkedin","internshala"] as const).map(k => (
                    <button
                      key={k}
                      onClick={() => setSourceFilter(k)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition ${sourceFilter===k ? 'bg-white/15 border-white/30' : 'bg-white/5 border-card-border hover:bg-white/10'}`}
                      title={`Show ${k}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <span className="sr-only" aria-live="polite">
              {loading ? 'Searching internships…' : `${derivedResults.length} results ready`}
            </span>

            {results.length === 0 && !loading && (
              <p className="text-muted-foreground">No results yet. Try a search above.</p>
            )}

            {results.length > 0 && derivedResults.length === 0 && !loading && (
              <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
                No results match current filters. Tip: turn off “New only” or lower Min relevance.
              </div>
            )}

            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-card-border bg-white/5 p-5">
                    <div className="h-4 w-2/3 bg-white/10 rounded shimmer mb-2" />
                    <div className="h-3 w-1/2 bg-white/10 rounded shimmer mb-4" />
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-white/10 rounded shimmer" />
                      <div className="h-3 w-5/6 bg-white/10 rounded shimmer" />
                      <div className="h-3 w-2/3 bg-white/10 rounded shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions panel */}
            {(analysis || analyzing) && (
              <div className="glass-card rounded-2xl p-4 border border-card-border/80">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold">Resume Suggestions</h3>
                  {analyzing && (
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-block h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Analyzing…
                    </span>
                  )}
                </div>
                {analysis && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Top Missing Keywords</div>
                      <div className="flex flex-wrap gap-2">
                        {(analysis.suggestions || []).slice(0, 8).map((s, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            + {s}
                          </span>
                        ))}
                        {analysis.suggestions?.length === 0 && (
                          <span className="text-xs text-muted-foreground">No gaps detected.</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">AI Weak Points</div>
                      <ul className="text-sm space-y-1 list-disc pl-4">
                        {(analysis.ai?.weak_points || []).slice(0, 5).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                        {(!analysis.ai || (analysis.ai.weak_points || []).length === 0) && (
                          <li className="text-muted-foreground">Nothing major found.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Grammar Fixes</div>
                      <ul className="text-sm space-y-1">
                        {(analysis.ai?.grammar_fixes || []).slice(0, 4).map((g, i) => (
                          <li key={i}>
                            <span className="opacity-80">{g.issue}</span>
                            <span className="opacity-60"> → </span>
                            <span className="font-medium">{g.suggestion}</span>
                          </li>
                        ))}
                        {(!analysis.ai || (analysis.ai.grammar_fixes || []).length === 0) && (
                          <li className="text-muted-foreground">Looks good.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HR Connect panel */}
            <div className="glass-card rounded-2xl p-4 border border-card-border/80">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Connect with HR / Recruiters</h3>
                {hrLoading && (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Searching…
                  </span>
                )}
              </div>
              {/* Quick company picker */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  value={hrCompany}
                  onChange={(e) => setHrCompany(e.target.value)}
                  placeholder="Company (e.g., NVIDIA)"
                  className="w-full sm:w-64 px-3 py-2 rounded-lg bg-white/5 border border-card-border focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <button
                  className="text-sm px-3 py-2 rounded-lg bg-white/5 border border-card-border hover:bg-white/10 transition"
                  onClick={async () => {
                    if (!hrCompany.trim()) return;
                    setHrLoading(true);
                    try {
                      const profs = await fetchHRProfiles({ company: hrCompany.trim(), roles: suggestedRoles.slice(0,2), location, skills: skills.slice(0,3), limit: 8 });
                      setHrProfiles(profs);
                    } catch (e) {
                      console.warn("HR profiles fetch (manual) failed", e);
                    } finally {
                      setHrLoading(false);
                    }
                  }}
                  title="Find recruiters at this company"
                >
                  Find Recruiters
                </button>
              </div>

              {/* People-search links */}
              <div className="flex flex-wrap gap-2 mb-3">
                {hrLinks.map((l, i) => (
                  <a
                    key={`hrl-${i}`}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1 rounded-full bg-white/5 border border-card-border hover:bg-white/10 transition"
                    title="Open LinkedIn people search"
                  >
                    {l.label || `HR search ${i+1}`}
                  </a>
                ))}
                {hrLinks.length === 0 && hrProfiles.length === 0 && (
                  <p className="text-sm text-muted-foreground">No HR links yet. Run a search to populate.</p>
                )}
              </div>

              {/* Profile cards (single company) */}
              {hrBatch === null && hrProfiles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hrProfiles.map((p, i) => {
                    const label = p.label || "LinkedIn Profile";
                    const clean = label.replace(/\s*\|\s*LinkedIn.*/i, "");
                    const parts = clean.split(/\s+-\s+/); // e.g., "Name - Technical Recruiter - NVIDIA"
                    const name = parts[0] || clean;
                    const subtitle = parts.slice(1).join(" • ");
                    const initials = name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map(s => s[0]?.toUpperCase())
                      .join("") || "HR";
                    return (
                      <div key={`card-${i}`} className="glass-card rounded-xl p-3 border border-card-border/80 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-200 font-semibold">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
                        </div>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 text-emerald-200 transition whitespace-nowrap"
                          title="Open LinkedIn profile"
                        >
                          Connect
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Grouped profile cards by company (batch) */}
              {hrBatch && hrBatch.length > 0 && (
                <div className="space-y-4">
                  {hrBatch.map((group, gi) => (
                    <div key={`grp-${gi}`}>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{group.company}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.profiles.map((p, i) => {
                          const label = p.label || "LinkedIn Profile";
                          const clean = label.replace(/\s*\|\s*LinkedIn.*/i, "");
                          const parts = clean.split(/\s+-\s+/);
                          const name = parts[0] || clean;
                          const subtitle = parts.slice(1).join(" • ");
                          const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "HR";
                          return (
                            <div key={`card-${gi}-${i}`} className="glass-card rounded-xl p-3 border border-card-border/80 flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-200 font-semibold">
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{name}</div>
                                {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
                              </div>
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 text-emerald-200 transition whitespace-nowrap">Connect</a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Portfolio generator panel */}
            <div className="glass-card rounded-2xl p-4 border border-card-border/80">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Instant Portfolio Website</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Turn your resume into an eye‑catching site with a starfield hero and gradient CTAs — branded for Find My Stipend. Download a ready-to-deploy ZIP (GitHub Pages or Vercel).
              </p>
              <div className="flex items-center gap-3">
                <button
                  className={`btn ${generatingPortfolio ? 'opacity-70 cursor-not-allowed' : 'btn-primary'} hover-lift`}
                  disabled={generatingPortfolio}
                  onClick={async () => {
                    setGeneratingPortfolio(true);
                    try {
                      const blob = await generatePortfolioZip(undefined, true, { ai: true, fullSiteAI: true });
                      downloadBlob(blob, 'portfolio.zip');
                    } catch (e) {
                      console.error('Portfolio generation failed', e);
                    } finally {
                      setGeneratingPortfolio(false);
                    }
                  }}
                >
                  {generatingPortfolio ? 'Generating…' : 'Generate Portfolio'}
                </button>
                <a
                  href="https://pages.github.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1 rounded-full bg-white/5 border border-card-border hover:bg-white/10 transition"
                >
                  GitHub Pages Guide
                </a>
                <a
                  href="https://vercel.com/docs/deployments/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1 rounded-full bg-white/5 border border-card-border hover:bg-white/10 transition"
                >
                  Deploy to Vercel
                </a>
              </div>
            </div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-[1fr]"
              variants={listVariants}
              initial="hidden"
              animate="show"
              layout
            >
              <AnimatePresence initial={false}>
                {derivedResults.map((job) => {
                  // Attach analyzer missing keywords by matching title+company
                  const missing = (() => {
                    const a = analysis?.results || [];
                    const found = a.find((r) =>
                      r.title?.toLowerCase() === (job.title || "").toLowerCase() &&
                      (r.company || "").toLowerCase() === (job.company || "").toLowerCase()
                    );
                    return found?.missing_keywords || [];
                  })();
                  const enriched = { ...(job as any), missing_keywords: missing } as any;
                  return (
                  <motion.div
                    layout
                    key={job.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    style={{ willChange: "transform, opacity" }}
                  >
                    <JobCard job={enriched} />
                  </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </div>
  </div>

        {/* Right - chat */}
        <aside className="space-y-6 lg:sticky lg:top-6 h-fit">
          {/* ChatWidget already includes its own ambient + glass layers in App.css */}
          <ChatWidget
            profile={{
              name: effective.name,
              college: effective.college || "",
              branch: effective.branch || "",
              year: effective.year || "",
              skills,
              interests,
            }}
            resumeUploaded={uploaded}
          />
        </aside>
      </div>
    </div>
    </div>
  );
}
