import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

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
  const [location, setLocation] = useState("India");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const profile: StudentProfile = {
      name,
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      interests: interests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      college: "",
      branch: "",
      year: "",
      location,
    };
    localStorage.setItem("onboarding", JSON.stringify(profile));
    onComplete?.(profile);
    try {
      navigate("/dashboard");
    } catch (error) {
      console.error("Navigation failed:", error);
    }
  }

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

          <div>
            <label className="block text-sm font-semibold mb-1">
              Skills (comma separated)
            </label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50 shadow-[0_0_0_0_rgba(255,255,255,0)] focus:shadow-[0_0_18px_2px_rgba(255,255,255,0.1)] transition"
              placeholder="Python, Machine Learning, React"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Interests (comma separated)
            </label>
            <input
              type="text"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              className="bg-input/50 border border-card-border rounded-full px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-white/50 shadow-[0_0_0_0_rgba(255,255,255,0)] focus:shadow-[0_0_18px_2px_rgba(255,255,255,0.1)] transition"
              placeholder="Data Science, AI, Web Development"
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