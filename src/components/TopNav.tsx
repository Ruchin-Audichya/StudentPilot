import { Link } from "react-router-dom";

type Action = { label: string; to: string; newTab?: boolean };

export default function TopNav({ actions = [] as Action[] }: { actions?: Action[] }) {
  return (
    <nav className="sticky top-0 z-30 bg-black/60 backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-base sm:text-lg font-bold tracking-tight">
          Find My Stipend<span className="align-super">®</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {actions.map((a) => (
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
      </div>
    </nav>
  );
}
