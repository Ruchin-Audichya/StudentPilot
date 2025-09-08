import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { startOnboarding, saveOnboardingData, savePreferences, type OnboardingPayload, type PreferencesPayload } from "@/services/onboardingService";
import SelectablePills from "@/components/ui/SelectablePills";
import { RECOMMENDED_INTERESTS, RECOMMENDED_LOCATIONS, RECOMMENDED_ROLES, RECOMMENDED_SKILLS } from "@/constants/recommendations";

interface StudentProfile {
  name: string;
  college?: string;
  branch?: string;
  year?: string;
  skills: string[];
  interests: string[];
  location?: string;
}

type OnboardingProps = {
  onComplete?: (profile: StudentProfile) => void;
};

export default function Onboarding({ onComplete }: OnboardingProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [skillsSel, setSkillsSel] = useState<string[]>([]);
  const [interestsSel, setInterestsSel] = useState<string[]>([]);
  const [location, setLocation] = useState("India");
  // New optional identity fields
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  // Preferences
  const [roles, setRoles] = useState("Software Engineer Intern");
  const [locations, setLocations] = useState("Remote, India");
  const [rolesSel, setRolesSel] = useState<string[]>(["Software Engineer Intern"]);
  const [locationsSel, setLocationsSel] = useState<string[]>(["Remote","India"]);
  const [workMode, setWorkMode] = useState<"remote"|"hybrid"|"onsite">("remote");
  const [stipendMin, setStipendMin] = useState<string>("");
  const [stipendMax, setStipendMax] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [companySize, setCompanySize] = useState<"small"|"mid"|"large"|"">("");
  const [alertTopics, setAlertTopics] = useState("SWE, Frontend, Backend");
  const [alertFreq, setAlertFreq] = useState<"off"|"daily"|"weekly">("weekly");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const profile: StudentProfile = {
      name,
      skills: (skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)).concat(skillsSel.filter(s=>!skills.includes(s))),
      interests: (interests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)).concat(interestsSel.filter(s=>!interests.includes(s))),
      college: "",
      branch: "",
      year: "",
      location,
    };
    localStorage.setItem("onboarding", JSON.stringify(profile));
    onComplete?.(profile);
    // Navigate immediately so UX is snappy
    try {
      navigate("/dashboard");
    } catch (error) {
      console.error("Navigation failed:", error);
    }
    // Persist to Firestore with anonymous UID in background (non-blocking)
    const payload: OnboardingPayload = {
      name: profile.name,
      college: profile.college,
      branch: profile.branch,
      year: profile.year,
      skills: profile.skills,
      interests: profile.interests,
      location: profile.location,
      phone: phone || undefined,
      links: {
        linkedin: linkedin || undefined,
        github: github || undefined,
        portfolio: portfolio || undefined,
      },
    };
    const prefs: PreferencesPayload = {
      roles: Array.from(new Set([
        ...roles.split(",").map(s=>s.trim()).filter(Boolean),
        ...rolesSel,
      ])),
      locations: Array.from(new Set([
        ...locations.split(",").map(s=>s.trim()).filter(Boolean),
        ...locationsSel,
      ])),
      workMode,
      stipendMin: stipendMin ? Number(stipendMin) : undefined,
      stipendMax: stipendMax ? Number(stipendMax) : undefined,
      startDate: startDate || undefined,
      companySize: (companySize || undefined) as any,
      alerts: {
        topics: alertTopics.split(",").map(s=>s.trim()).filter(Boolean),
        freq: alertFreq,
      },
    };
    // Fire and forget saves
    saveOnboardingData(payload).catch((err) => console.warn("Failed to save onboarding data:", err));
    savePreferences(prefs).catch((err) => console.warn("Failed to save preferences:", err));
  }

  // Ensure anonymous user session exists when page loads
  useEffect(() => {
    startOnboarding().catch((e) => {
      // non-fatal; onboarding can proceed locally
      console.warn("Anonymous sign-in failed (non-blocking):", e);
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full glass-card rounded-2xl p-8">
        <h1 className="text-2xl md:text-3xl font-extrabold mb-2">Welcome!</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Fill your details to personalize recommendations.
        </p>

        {/* Progress bar (simple, animated) */}
        <div className="mb-4 h-2 w-full rounded bg-white/10 overflow-hidden">
          <motion.div className="h-full bg-white/60" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.8 }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key="step-basic"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
          <div>
            <label className="block text-sm font-semibold mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50 shadow-[0_0_0_0_rgba(255,255,255,0)] focus:shadow-[0_0_20px_2px_rgba(255,255,255,0.12)] transition"
              placeholder="John Doe"
            />
          </div>

          {/* Contact & Links */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="+91-..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">LinkedIn URL</label>
              <input
                type="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="https://linkedin.com/in/username"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">GitHub URL</label>
              <input
                type="url"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="https://github.com/username"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Portfolio URL</label>
              <input
                type="url"
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="https://yourdomain.com"
              />
            </div>
          </div>

          <SelectablePills
            label="Skills"
            options={RECOMMENDED_SKILLS}
            selected={skillsSel}
            onChange={setSkillsSel}
            placeholder="Add custom skills…"
            className=""
          />
          <div>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="mt-2 bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="Optional: comma separated skills"
            />
          </div>

          <SelectablePills
            label="Interests"
            options={RECOMMENDED_INTERESTS}
            selected={interestsSel}
            onChange={setInterestsSel}
            placeholder="Add custom interests…"
          />
          <div>
            <input
              type="text"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              className="mt-2 bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="Optional: comma separated interests"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Preferred Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50 shadow-[0_0_0_0_rgba(255,255,255,0)] focus:shadow-[0_0_18px_2px_rgba(255,255,255,0.1)] transition"
              placeholder="India, Remote, New Delhi"
            />
          </div>

          {/* Preferences */}
          <SelectablePills
            label="Preferred Roles"
            options={RECOMMENDED_ROLES}
            selected={rolesSel}
            onChange={setRolesSel}
            placeholder="Add roles…"
          />
          <div>
            <input
              type="text"
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              className="mt-2 bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="Optional: comma separated roles"
            />
          </div>

          <SelectablePills
            label="Preferred Locations"
            options={RECOMMENDED_LOCATIONS}
            selected={locationsSel}
            onChange={setLocationsSel}
            placeholder="Add locations…"
          />
          <div>
            <input
              type="text"
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              className="mt-2 bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="Optional: comma separated locations"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Work Mode</label>
              <select
                value={workMode}
                onChange={(e)=>setWorkMode(e.target.value as any)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Stipend Min (₹)</label>
              <input
                type="number"
                value={stipendMin}
                onChange={(e)=>setStipendMin(e.target.value)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="0"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Stipend Max (₹)</label>
              <input
                type="number"
                value={stipendMax}
                onChange={(e)=>setStipendMax(e.target.value)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="50000"
                min={0}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Earliest Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e)=>setStartDate(e.target.value)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Preferred Company Size</label>
              <select
                value={companySize}
                onChange={(e)=>setCompanySize(e.target.value as any)}
                className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="">No preference</option>
                <option value="small">Startup (1-50)</option>
                <option value="mid">Mid (51-500)</option>
                <option value="large">Large (500+)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Job Alert Topics (comma separated)</label>
            <input
              type="text"
              value={alertTopics}
              onChange={(e)=>setAlertTopics(e.target.value)}
              className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="SWE, Frontend, Backend"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Alert Frequency</label>
            <select
              value={alertFreq}
              onChange={(e)=>setAlertFreq(e.target.value as any)}
              className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-white text-black py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
          >
            Continue to Dashboard
          </button>
          </motion.form>
        </AnimatePresence>
      </div>
    </div>
  );
}