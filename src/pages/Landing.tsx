import { useState } from "react";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import resumeImg from "@/assets/resume.jpg"; // Save your resume image to src/assets/resume.jpg
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
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-8 py-4">
        <h1 className="text-lg font-bold">Where’s My Stipend®</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <Link to="/onboarding" className="hover:text-gray-300">Use The Tool</Link>
          <a
            href="https://github.com/Ruchin-Audichya/StudentPilot"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-gray-300"
          >
            <FaGithub size={18} /> GitHub
          </a>
          <div className="relative">
            <button
              onClick={handleLinkedInClick}
              className="flex items-center gap-2 hover:text-gray-300"
            >
              <FaLinkedin size={18} /> LinkedIn
            </button>
            {showLinkedInMenu && (
              <div className="absolute top-8 right-0 bg-white text-black rounded shadow-lg z-10">
                <button
                  onClick={() =>
                    openLinkedIn("https://www.linkedin.com/in/ruchinaudi/")
                  }
                  className="block w-full px-4 py-2 hover:bg-gray-200 text-left"
                >
                  Ruchin’s Profile
                </button>
                <button
                  onClick={() =>
                    openLinkedIn(
                      "https://www.linkedin.com/in/shriya-gakkhar-b87b4a289/"
                    )
                  }
                  className="block w-full px-4 py-2 hover:bg-gray-200 text-left"
                >
                  Shriya’s Profile
                </button>
              </div>
            )}
          </div>
          <Link
            to="/onboarding"
            className="bg-white text-black px-4 py-2 rounded-full font-semibold"
          >
            Find My Stipend
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center mt-20">
        <h2 className="text-5xl font-bold mb-4">Where’s My Stipend?</h2>
        <p className="text-gray-400 text-lg mb-8">
          Your skills. Your dreams. Your stipend — delivered.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/onboarding"
            className="bg-white text-black px-6 py-3 rounded-full font-semibold"
          >
            Find My Stipend
          </Link>
          <Link
            to="/onboarding"
            className="border border-white px-6 py-3 rounded-full font-semibold hover:bg-white hover:text-black"
          >
            Sign Up
          </Link>
        </div>
      </section>

      {/* Image */}
      <div className="flex justify-center mt-16">
        <img src={resumeImg} alt="Resume" className="w-64 rounded shadow-lg" />
      </div>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 px-12 py-16">
        <div>
          <h3 className="text-xl font-bold mb-2">Resume analysis.</h3>
          <p className="text-gray-400">Upload your CV for smart insights.</p>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">AI matching.</h3>
          <p className="text-gray-400">
            Personalized internship and job finds.
          </p>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Live scraping.</h3>
          <p className="text-gray-400">
            Direct from Internshala, always fresh.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-4 text-gray-500 text-sm">
        Made by Ruchin & Shriya <span className="ml-1">👏</span>
      </footer>
    </div>
  );
}
