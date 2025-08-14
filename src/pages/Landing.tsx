import { useState } from "react";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FileText, Sparkles, Globe } from "lucide-react";
import resumeImg from "@/assets/resume.png"; // Using PNG for the resume image
import { Link } from "react-router-dom";

export default function Landing() {
  const [showLinkedInMenu, setShowLinkedInMenu] = useState(false);

  const handleLinkedInClick = () => {
    setShowLinkedInMenu(!showLinkedInMenu);
  };

  const openLinkedIn = (url: string) => {
    window.open(url, "_blank");
    setShowLinkedInMenu(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-black/60 backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-base sm:text-lg font-bold tracking-tight">
            Where’s My Stipend<span className="align-super">®</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <Link to="/onboarding" className="hover:text-gray-300 text-sm sm:text-base">Use The Tool</Link>
            <a
              href="https://github.com/Ruchin-Audichya/StudentPilot"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:text-gray-300 text-sm sm:text-base"
            >
              <FaGithub size={18} /> GitHub
            </a>
            <div className="relative">
              <button
                onClick={handleLinkedInClick}
                className="flex items-center gap-2 hover:text-gray-300 text-sm sm:text-base"
              >
                <FaLinkedin size={18} /> LinkedIn
              </button>
              {showLinkedInMenu && (
                <div className="absolute top-8 right-0 bg-white text-black rounded-md shadow-lg z-10 w-48 overflow-hidden">
                  <button
                    onClick={() => openLinkedIn("https://www.linkedin.com/in/ruchinaudi/")}
                    className="block w-full px-4 py-2 hover:bg-gray-200 text-left text-sm"
                  >
                    Ruchin’s Profile
                  </button>
                  <button
                    onClick={() => openLinkedIn("https://www.linkedin.com/in/shriya-gakkhar-b87b4a289/")}
                    className="block w-full px-4 py-2 hover:bg-gray-200 text-left text-sm"
                  >
                    Shriya’s Profile
                  </button>
                </div>
              )}
            </div>
            <Link
              to="/auth"
              className="bg-white text-black px-4 py-2 rounded-full font-semibold text-sm sm:text-base"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-10 md:pb-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
          <Sparkles size={14} className="text-yellow-300" /> AI-powered intern finder
        </span>
        <h2 className="mt-4 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Where’s My Stipend?
        </h2>
        <p className="mt-3 sm:mt-4 text-gray-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto">
          Your skills. Your dreams. Your stipend—delivered.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            className="bg-white text-black px-5 py-3 rounded-full font-semibold text-sm sm:text-base shadow hover:bg-gray-200"
          >
            Find My Stipend
          </Link>
          <Link
            to="/onboarding"
            className="px-5 py-3 rounded-full font-semibold text-sm sm:text-base border border-white/20 hover:bg-white/10"
          >
            Try Demo
          </Link>
        </div>
      </section>

      {/* Image */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl">
          <img
            src={resumeImg}
            alt="Resume"
            className="block w-full rounded-xl shadow-2xl ring-1 ring-white/10 object-contain"
          />
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-2xl bg-gradient-to-r from-white/10 to-white/0 blur-2xl" />
        </div>
      </div>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 sm:p-6 hover:bg-white/[0.08] transition">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <FileText size={18} />
              </span>
              <h3 className="text-lg font-bold">Resume analysis</h3>
            </div>
            <p className="text-gray-400 text-sm sm:text-base">Upload your CV for smart insights.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 sm:p-6 hover:bg-white/[0.08] transition">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <Sparkles size={18} />
              </span>
              <h3 className="text-lg font-bold">AI matching</h3>
            </div>
            <p className="text-gray-400 text-sm sm:text-base">Personalized internship and job finds.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 sm:p-6 hover:bg-white/[0.08] transition">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <Globe size={18} />
              </span>
              <h3 className="text-lg font-bold">Live scraping</h3>
            </div>
            <p className="text-gray-400 text-sm sm:text-base">Internshala and LinkedIn, always fresh.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-500 text-xs sm:text-sm">
        {/* Footer intentionally minimal */}
      </footer>
    </div>
  );
}