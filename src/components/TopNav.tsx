import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

type Action = { label: string; to: string; newTab?: boolean };

export default function TopNav({ actions = [] as Action[] }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Always add OppRadar to actions if not present
  const mergedActions = [
    ...actions,
    { label: "🛰️ Opportunity Radar", to: "/oppradar" },
    { label: "🏛️ Gov Snapshot", to: "/gov-snapshot" },
  ].filter((a, i, arr) => arr.findIndex(x => x.to === a.to) === i);
  return (
  <nav className="sticky top-0 z-30 w-full bg-black/60 backdrop-blur border-b border-white/10 text-white safe-top">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
        <Link to="/" className="text-base sm:text-lg font-bold tracking-tight">
          Find My Stipend<span className="align-super">®</span>
        </Link>
        {/* Right cluster: desktop (actions + logout) */}
        <div className="hidden sm:flex items-center gap-2 ml-auto">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {mergedActions.map((a) => {
              const active = pathname === a.to || (a.to !== '/' && pathname.startsWith(a.to));
              const base = "px-3 py-1.5 rounded-md text-sm transition border border-transparent";
              const cls = active
                ? `${base} gradient-primary text-white shadow-md`
                : `${base} text-white/80 hover:text-white hover:bg-white/10`;
              return a.newTab ? (
                <a
                  key={a.to}
                  href={a.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls}
                >
                  {a.label}
                </a>
              ) : (
                <Link key={a.to} to={a.to} className={cls}>
                  {a.label}
                </Link>
              );
            })}
          </div>
          <Link to="/logout" className="px-3 py-1.5 rounded-md text-sm font-semibold gradient-primary text-white shadow-md border border-transparent hover:opacity-95">
            Logout
          </Link>
        </div>
        {/* Mobile controls: menu and logout inline at right */}
        <div className="sm:hidden ml-auto flex items-center gap-2">
          <button onClick={() => setOpen(v => !v)} className="px-3 py-1.5 rounded-md bg-white/10 border border-white/20 text-sm font-semibold hover:bg-white/15">Menu</button>
          <Link to="/logout" className="px-3 py-1.5 rounded-md text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/15">
            Logout
          </Link>
        </div>
      </div>
      {open && (
        <div className="sm:hidden px-3 pb-3">
          <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur p-2 grid grid-cols-2 gap-2">
            <Link to="/mock-interview" className="wm-pill px-3 py-2 text-sm text-left">🎙️ Mock Interview</Link>
            <Link to="/resume-genius" className="wm-pill px-3 py-2 text-sm text-left">🧠 Resume Genius</Link>
            <Link to="/dashboard" className="wm-pill px-3 py-2 text-sm text-left">📅 Dashboard</Link>
            <Link to="/oppradar" className="wm-pill px-3 py-2 text-sm text-left">🛰️ Opportunity Radar</Link>
            <Link to="/gov-snapshot" className="wm-pill px-3 py-2 text-sm text-left">🏛️ Gov Snapshot</Link>
            <Link to="/logout" className="wm-pill px-3 py-2 text-sm text-left">🚪 Logout</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
