import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, MessageCircle, FileText, MoreHorizontal, Radar, Landmark } from "lucide-react";

export default function MobileTabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const go = (to: string) => {
    setOpen(false);
    if (pathname !== to) nav(to);
  };

  const Item = ({ icon: Icon, label, to }: { icon: any; label: string; to: string }) => {
    const active = pathname === to || (to !== '/' && pathname.startsWith(to));
    return (
      <button
        onClick={() => go(to)}
        className="group flex-1 flex items-center justify-center"
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        <div
          className={
            `flex flex-col items-center justify-center px-3 py-2 rounded-xl text-[11px] transition ${
              active
                ? 'text-white gradient-primary glow-primary shadow-md'
                : 'text-white/75 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Icon className={`w-5 h-5 mb-0.5 ${active ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
          <span className="leading-none">{label}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="sm:hidden fixed left-0 right-0 bottom-0 z-50 safe-bottom">
      <div className="mobile-tabbar glass-card bg-black/60 backdrop-blur px-2 py-1 border-t border-white/10">
        <div className="flex items-center justify-between gap-1">
          <Item icon={Home} label="Home" to="/" />
          <Item icon={LayoutDashboard} label="Dashboard" to="/dashboard" />
          <Item icon={Radar} label="OppRadar" to="/oppradar" />
          <Item icon={Landmark} label="Gov" to="/gov-snapshot" />
          <Item icon={MessageCircle} label="Chat" to="/chat" />
          <Item icon={FileText} label="Resume" to="/resume-genius" />
          <button
            onClick={() => setOpen(v => !v)}
            className="flex-1 flex items-center justify-center"
            aria-expanded={open}
            aria-label="More"
          >
            <div className="flex flex-col items-center justify-center px-3 py-2 rounded-xl text-[11px] text-white/80 hover:text-white hover:bg-white/5 transition">
              <MoreHorizontal className="w-5 h-5 mb-0.5" />
              <span>More</span>
            </div>
          </button>
        </div>
      </div>
      {open && (
        <div className="absolute bottom-[64px] left-0 right-0 px-3 pb-2">
          <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur p-2 grid grid-cols-2 gap-2 mx-2">
            <button onClick={() => go('/mock-interview')} className="wm-pill px-3 py-2 text-sm text-left">🎙️ Mock Interview</button>
            <button onClick={() => go('/oppradar')} className="wm-pill px-3 py-2 text-sm text-left">🛰️ OppRadar</button>
            <button onClick={() => go('/resume-genius')} className="wm-pill px-3 py-2 text-sm text-left">🧠 Resume Genius</button>
            <button onClick={() => go('/dashboard')} className="wm-pill px-3 py-2 text-sm text-left">📅 Dashboard</button>
            <button onClick={() => go('/logout')} className="wm-pill px-3 py-2 text-sm text-left">🚪 Logout</button>
          </div>
        </div>
      )}
    </div>
  );
}
