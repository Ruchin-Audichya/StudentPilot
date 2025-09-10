import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, MessageCircle, FileText, MoreHorizontal } from "lucide-react";

export default function MobileTabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const go = (to: string) => {
    setOpen(false);
    if (pathname !== to) nav(to);
  };

  const Item = ({ icon: Icon, label, to }: { icon: any; label: string; to: string }) => (
    <button
      onClick={() => go(to)}
      className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] ${pathname === to ? 'text-white' : 'text-white/70'}`}
      aria-label={label}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="sm:hidden fixed left-0 right-0 bottom-0 z-50">
      <div className="mobile-tabbar bg-black/65 backdrop-blur border-t border-white/10 px-2 py-1 safe-bottom">
        <div className="flex items-center justify-between gap-1">
          <Item icon={Home} label="Home" to="/" />
          <Item icon={LayoutDashboard} label="Dashboard" to="/dashboard" />
          <Item icon={MessageCircle} label="Chat" to="/chat" />
          <Item icon={FileText} label="Resume" to="/resume-genius" />
          <button
            onClick={() => setOpen(v => !v)}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] text-white/80"
            aria-expanded={open}
            aria-label="More"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>More</span>
          </button>
        </div>
      </div>
      {open && (
        <div className="absolute bottom-[64px] left-0 right-0 px-3 pb-2">
          <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur p-2 grid grid-cols-2 gap-2 mx-2">
            <button onClick={() => go('/mock-interview')} className="wm-pill px-3 py-2 text-sm text-left">🎙️ Mock Interview</button>
            <button onClick={() => go('/resume-genius')} className="wm-pill px-3 py-2 text-sm text-left">🧠 Resume Genius</button>
            <button onClick={() => go('/dashboard')} className="wm-pill px-3 py-2 text-sm text-left">📅 Dashboard</button>
            <button onClick={() => go('/logout')} className="wm-pill px-3 py-2 text-sm text-left">🚪 Logout</button>
          </div>
        </div>
      )}
    </div>
  );
}
