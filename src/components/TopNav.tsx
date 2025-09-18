import { Link } from "react-router-dom";
import { useState } from "react";

type Action = { label: string; to: string; newTab?: boolean };

export default function TopNav({ actions = [] as Action[] }) {
  const [open, setOpen] = useState(false);
  // Always add OppRadar to actions if not present
  const mergedActions = [
    ...actions,
    { label: "🛰️ Opportunity Radar", to: "/oppradar" },
  ].filter((a, i, arr) => arr.findIndex(x => x.to === a.to) === i);
  return (
    <nav className="sticky top-0 z-30 w-screen left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        <h1 className="text-base sm:text-lg font-bold tracking-tight">
          Find My Stipend<span className="align-super">®</span>
        </h1>
        {/* Desktop actions */}
        <div className="hidden sm:flex flex-wrap items-center gap-2 sm:gap-3">
          {mergedActions.map((a) => (
            a.newTab ? (
              <a
                key={a.to}
                href={a.to}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-200"
              >
                {a.label}
              </a>
            ) : (
              <Link key={a.to} to={a.to} className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-200">
                {a.label}
              </Link>
            )
          ))}
        </div>
        {/* Mobile menu */}
        <div className="sm:hidden ml-auto">
          <button onClick={() => setOpen(v => !v)} className="px-3 py-1.5 rounded-full bg-white text-black text-sm font-semibold">Menu</button>
        </div>
      </div>
      {open && (
        <div className="sm:hidden px-3 pb-3">
          <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur p-2 grid grid-cols-2 gap-2">
            <Link to="/mock-interview" className="wm-pill px-3 py-2 text-sm text-left">🎙️ Mock Interview</Link>
            <Link to="/resume-genius" className="wm-pill px-3 py-2 text-sm text-left">🧠 Resume Genius</Link>
            <Link to="/dashboard" className="wm-pill px-3 py-2 text-sm text-left">📅 Dashboard</Link>
            <Link to="/oppradar" className="wm-pill px-3 py-2 text-sm text-left">🛰️ Opportunity Radar</Link>
            <Link to="/logout" className="wm-pill px-3 py-2 text-sm text-left">🚪 Logout</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
