import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { fetchGovFeeds } from "@/services/govApi";
import JobCard from "@/components/JobCard";

type Row = {
  title: string; company: string; location: string; stipend?: string; url?: string; score?: number; verified?: boolean; source?: string;
};

export default function GovSnapshot() {
  const [stateFilter, setStateFilter] = useState<string>(new URLSearchParams(location.search).get("state") || "Rajasthan");
  const [onlyVerified, setOnlyVerified] = useState<boolean>((new URLSearchParams(location.search).get("verified") || "true") === "true");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true); setError(null);
      try {
        // Prefer live endpoint by using higher limit; backend decides the route on server
        const res = await fetchGovFeeds({ state: stateFilter || undefined, only_verified: onlyVerified, limit: 100 });
        setItems(res);
      } catch (e: any) {
        setError(e?.message || "Failed to load feeds");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [stateFilter, onlyVerified]);

  const csv = useMemo(() => {
    const rows: Row[] = items.map((x: any) => ({
      title: x.title,
      company: x.company,
      location: x.location,
      stipend: x.stipend,
      url: x.url,
      score: x.score,
      verified: (x as any).verified,
      source: x.source,
    }));
    const header = Object.keys(rows[0] || { title: "", company: "", location: "", stipend: "", url: "", score: 0, verified: true, source: "gov" });
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.join(","), ...rows.map(r => header.map(h => esc((r as any)[h])).join(","))];
    return lines.join("\n");
  }, [items]);

  const json = useMemo(() => JSON.stringify(items, null, 2), [items]);

  const download = (text: string, filename: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 mb-4">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground">State</label>
            <input
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              placeholder="e.g., Rajasthan, Maharashtra, All"
              className="mt-1 w-full rounded-lg border border-card-border bg-card px-3 py-2"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} />
            Show only verified
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => download(csv, `gov-snapshot-${Date.now()}.csv`, "text/csv")}
              className="text-sm px-3 py-2 rounded-md bg-white/5 border border-card-border hover:bg-white/10">Export CSV</button>
            <button onClick={() => download(json, `gov-snapshot-${Date.now()}.json`, "application/json")}
              className="text-sm px-3 py-2 rounded-md bg-white/5 border border-card-border hover:bg-white/10">Export JSON</button>
          </div>
        </div>

        {error && <div className="text-sm text-rose-300 mb-4">{error}</div>}
        {loading && <div className="text-sm text-muted-foreground mb-4">Loading government feeds…</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((job, i) => (
            <JobCard key={job.id || i} job={job} />
          ))}
        </div>
      </main>
    </div>
  );
}
