import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import { searchInternships, JobResult } from "@/services/jobApi";
import JobCard from "@/components/JobCard";

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
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem("onboarding") || "null") as StudentProfile | null; } catch { return null; }
  })();
  const effective = profile || stored || { name: "Friend", skills: [], interests: [] };
  const [skills, setSkills] = useState<string[]>(effective.skills || []);
  const [interests, setInterests] = useState<string[]>(effective.interests || []);
  const [location, setLocation] = useState<string>("India");
  const [results, setResults] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // Chatbot states
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const firstName = useMemo(() => (effective?.name || "").split(" ")[0] || "there", [effective?.name]);

  // Lightweight animation variants for result items (non-blocking, short duration)
  const listVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.06, delayChildren: 0.02 },
    },
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

  async function handleResumeUpload() {
    if (!resumeFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", resumeFile);
      const res = await fetch(`${API_BASE}/api/upload-resume`, {
        method: "POST",
        body: formData,
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
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) headers["id_token"] = token;
      } catch {}

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: userMsg.text }),
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

  function renderFormatted(text: string) {
    // Basic bullet rendering: lines starting with '-' become list items
    const blocks = text.split(/\n\n+/);
    return (
      <div className="space-y-2">
        {blocks.map((block, i) => {
          const lines = block.split(/\n/);
          const isList = lines.every(l => l.trim().startsWith("-") || l.trim() === "");
          if (isList) {
            return (
              <ul key={i} className="list-disc pl-5 space-y-1">
                {lines.filter(l => l.trim().startsWith("-")).map((l, idx) => (
                  <li key={idx}>{l.replace(/^\s*-\s*/, "")}</li>
                ))}
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
      {/* Top bar */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Hi, {firstName} 👋
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Let’s help you land your dream internship.
          </p>
        </div>
        <a href="/logout" className="px-4 py-2 rounded-full bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 transition">
          Logout
        </a>
      </header>

      {/* Main content layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resume uploader */}
          <div className="glass-card rounded-2xl p-5 md:p-6 animate-fade-in">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">Upload Resume</h2>
                <p className="text-sm text-muted-foreground">We’ll use it to refine matches and chat context.</p>
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
                  className={`rounded-full px-5 py-2 text-white shadow-md hover:opacity-95 transition disabled:opacity-50 ${uploaded ? "bg-green-600" : ""} ${!uploaded ? "gradient-primary" : ""}`}
                >
                  {uploading ? "Uploading..." : uploaded ? "Uploaded • Replace" : "Upload"}
                </button>
              </div>
            </div>
          </div>

          {/* Search panel */}
          <div className="glass-card rounded-3xl p-5 md:p-6 shadow-lg hover:shadow-xl transition-shadow animate-slide-up">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Find Internships</h2>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="rounded-full px-5 py-2 gradient-success text-white shadow-md hover:shadow-lg hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="🔍 Search by role or skill… e.g. React, Python"
                defaultValue={skills.join(", ")}
                onChange={(e) => setSkills(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                className="bg-input/50 border border-card-border rounded-2xl px-3 py-2 shadow-sm hover:shadow focus:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="text"
                placeholder="✨ Interests e.g. AI, Web Dev"
                defaultValue={interests.join(", ")}
                onChange={(e) => setInterests(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                className="bg-input/50 border border-card-border rounded-2xl px-3 py-2 shadow-sm hover:shadow focus:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="text"
                placeholder="📍 Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-input/50 border border-card-border rounded-2xl px-3 py-2 shadow-sm hover:shadow focus:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
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
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Results</h2>
              <span className="text-sm text-muted-foreground">{results.length} matches</span>
            </div>
            {results.length === 0 && !loading && (
              <p className="text-muted-foreground">No results yet. Try a search above.</p>
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
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              variants={listVariants}
              initial="hidden"
              animate="show"
              layout
            >
              <AnimatePresence initial={false}>
                {results.map((job) => (
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
        <aside className="space-y-6">
          <div className="glass-card rounded-2xl p-5 md:p-6 h-[480px] flex flex-col">
            <h2 className="text-lg font-semibold mb-2">Career Chatbot</h2>
            <div className="flex-1 overflow-y-auto rounded-xl bg-background/40 border border-card-border p-3">
              {chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground">Ask me about roles, skills to learn, or how to improve your resume.</p>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`mb-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                  <span className={`inline-block px-3 py-2 rounded-2xl text-sm ${msg.role === "user" ? "gradient-primary text-white" : "bg-white/5 border border-card-border"}`}>
                    {msg.role === "user" ? (
                      msg.text
                    ) : (
                      renderFormatted(msg.text)
                    )}
                  </span>
                </div>
              ))}
              {chatLoading && (
                <div className="mb-2 text-left">
                  <span className="inline-block px-3 py-2 rounded-2xl bg-white/5 border border-card-border">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-current animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </span>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about internships..."
                className="flex-1 bg-input/50 border border-card-border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading}
                className="rounded-full px-5 py-2 gradient-secondary text-foreground hover:opacity-95 transition disabled:opacity-50"
              >
                {chatLoading ? "..." : "Send"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
