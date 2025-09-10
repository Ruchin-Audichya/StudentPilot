import { useMemo, useState, useEffect, useRef } from "react";
import { API_BASE } from "@/lib/apiBase";
import { motion, AnimatePresence } from "framer-motion";
import ChatWidget from "./ChatWidget";
import { auth } from "@/lib/firebase";
import { searchInternships, JobResult } from "@/services/jobApi";
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
  const [loading, setLoading] = useState(false);
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"scoreDesc" | "source" | "recent">("scoreDesc");
  const [autoSearch, setAutoSearch] = useState(false);

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
      const jobs = await searchInternships({ skills, interests, location });
      setResults(jobs);
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
    if (onlyPaid) arr = arr.filter((j) => !!(j.stipend && String(j.stipend).trim()));
    if (onlyNew) arr = arr.filter((j) => j.is_new);
    if (minScore > 0) arr = arr.filter((j) => (j.score ?? 0) >= minScore);
    if (sortBy === "scoreDesc") arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    else if (sortBy === "source") arr.sort((a, b) => (a.source || "").localeCompare(b.source || ""));
    // 'recent' is backend-dependent; keep original order as scraped
    return arr;
  }, [results, onlyPaid, onlyNew, minScore, sortBy]);

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
    <div className="min-h-screen p-6 md:p-8">
      <TopNav
        actions={[
          { label: "🎙️ Mock Interview", to: "/mock-interview" },
          { label: "🧠 Resume Genius", to: "/resume-genius" },
          { label: "Logout", to: "/logout" },
        ]}
      />
      <div className="mb-4">
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
              <span className="text-sm text-muted-foreground">
                {loading ? '—' : `${derivedResults.length} matches`}
              </span>
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

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-[1fr]"
              variants={listVariants}
              initial="hidden"
              animate="show"
              layout
            >
              <AnimatePresence initial={false}>
                {derivedResults.map((job) => (
                  <motion.div
                    layout
                    key={job.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    style={{ willChange: "transform, opacity" }}
                  >
                    <JobCard job={job} />
                  </motion.div>
                ))}
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
  );
}
