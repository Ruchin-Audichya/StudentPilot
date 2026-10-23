import { useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutDashboard, FileText, BriefcaseBusiness, type LucideIcon } from "lucide-react";

export default function MobileTabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  const go = (to: string) => {
    if (pathname !== to) nav(to);
  };

  const Item = ({ icon: Icon, label, to }: { icon: LucideIcon; label: string; to: string }) => {
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
          <Item icon={LayoutDashboard} label="Search" to="/dashboard" />
          <Item icon={BriefcaseBusiness} label="Apply" to="/jobs" />
          <Item icon={FileText} label="Resume" to="/resume-genius" />
        </div>
      </div>
    </div>
  );
}
