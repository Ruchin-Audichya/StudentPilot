import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { fetchGovFeeds } from "@/services/govApi";
import { API_BASE } from "@/lib/apiBase";
import JobCard from "@/components/JobCard";
import { useMemo as _useMemo } from "react";

type Row = {
  title: string; company: string; location: string; stipend?: string; url?: string; score?: number; verified?: boolean; source?: string;
};

export default function GovSnapshot() {
  const qp = new URLSearchParams(location.search);
  const [stateFilter, setStateFilter] = useState<string>((qp.get("state") || "") === "All" ? "" : (qp.get("state") || ""));
  const [onlyVerified, setOnlyVerified] = useState<boolean>((qp.get("verified") || "true") === "true");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isAdmin = (qp.get("admin") === "1");
  const [selectedSources, setSelectedSources] = useState<string[]>([]); // aicte,ncs,mygov,drdo,niti,maharashtra
  const commonStates = ["All","Rajasthan","Maharashtra","Delhi","Karnataka","Tamil Nadu","Gujarat"];
  const [pending, setPending] = useState<any[]>([]);
  const [modLoading, setModLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true); setError(null);
      try {
        // Prefer live endpoint via service; refreshKey triggers a bypass
        const res: any = await (fetchGovFeeds as any)({ state: stateFilter || undefined, only_verified: onlyVerified, limit: 100, _force: refreshKey > 0 });
        // Service returns normalized JobResult[]; also attempt to fetch cache-info for timestamp
        setItems(res);
        try {
          const r = await fetch(`${API_BASE}/api/gov/feeds/cache-info`);
          if (r.ok) {
            const meta = await r.json();
            setCachedAt(typeof meta.cached_at === "number" ? meta.cached_at : null);
          }
        } catch {}
      } catch (e: any) {
        setError(e?.message || "Failed to load feeds");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [stateFilter, onlyVerified, refreshKey]);

  // Admin: load pending low-trust items
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setModLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/gov/mod/pending?threshold=70`);
        const d = await r.json();
        setPending(Array.isArray(d?.results) ? d.results : []);
      } catch {
        setPending([]);
      } finally {
        setModLoading(false);
      }
    })();
  }, [isAdmin, refreshKey]);

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

  // Derived items by selected source filters
  const filteredItems = useMemo(() => {
    if (!selectedSources.length) return items;
    const getTags = (x: any) => (x.required_skills || x.tags || []).map((v: any) => String(v).toLowerCase());
    const src = (x: any) => String(x.source || "").toLowerCase();
    const synonyms: Record<string, string[]> = {
      "tamil nadu": ["tamil nadu", "tamilnadu", "tn"],
      maharashtra: ["maharashtra", "mahaswayam", "maha"],
    };
    const matchesKey = (x: any, key: string) => {
      const keys = [key, ...(synonyms[key] || [])];
      const tags = getTags(x);
      const s = src(x);
      return keys.some(k => tags.includes(k) || s.includes(k));
    };
    return items.filter(x => selectedSources.some(s => matchesKey(x, s)));
  }, [items, selectedSources]);

  const resultCount = filteredItems.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold">Government Snapshot</h1>
          <p className="text-sm text-muted-foreground">Find official internship opportunities aggregated from AICTE, NCS, MyGov, DRDO, NITI Aayog, and MahaSwayam.</p>
        </header>
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 mb-3">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground">State</label>
            <input
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              placeholder="e.g., Rajasthan, Maharashtra, All"
              className="mt-1 w-full rounded-lg border border-card-border bg-card px-3 py-2"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {commonStates.map((s) => (
                <button
                  key={s}
                  onClick={() => setStateFilter(s === "All" ? "" : s)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    (s === "All" ? !stateFilter : stateFilter.toLowerCase() === s.toLowerCase())
                      ? "bg-white/10 border-white/20"
                      : "bg-white/5 border-card-border hover:bg-white/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} />
            Show only verified
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={loading}
              aria-busy={loading}
              className="text-sm px-3 py-2 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >{loading ? 'Searching…' : 'Search'}</button>
            <button onClick={() => download(csv, `gov-snapshot-${Date.now()}.csv`, "text/csv")}
              className="text-sm px-3 py-2 rounded-md bg-white/5 border border-card-border hover:bg-white/10">Export CSV</button>
            <button onClick={() => download(json, `gov-snapshot-${Date.now()}.json`, "application/json")}
              className="text-sm px-3 py-2 rounded-md bg-white/5 border border-card-border hover:bg-white/10">Export JSON</button>
            {isAdmin && (
              <button onClick={() => setRefreshKey(k => k + 1)}
                className="text-sm px-3 py-2 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20">Refresh</button>
            )}
          </div>
        </div>

        {/* Small banner: last cache + tagline; show Refresh if admin */}
        <div className="mb-4 rounded-md border border-card-border bg-white/5 px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="text-muted-foreground">
            Government Snapshot · {cachedAt ? (
              <span>Last refreshed {new Date(cachedAt * 1000).toLocaleString()}</span>
            ) : (
              <span>Fetching latest…</span>
            )}
          </div>
          <div className="text-muted-foreground">
            Aggregates official opportunities from AICTE, NCS, MyGov, DRDO, NITI Aayog, and MahaSwayam as per SIH problem statement.
          </div>
          {isAdmin && (
            <div className="sm:ml-auto">
              <button onClick={() => setRefreshKey(k => k + 1)} className="text-xs px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20">
                Refresh cache
              </button>
            </div>
          )}
        </div>

        {/* Sticky source filter bar */}
        <div className="sticky top-14 z-20 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur px-3 py-2 flex flex-wrap gap-2 items-center">
            {[
              { key: "aicte", label: "AICTE" },
              { key: "ncs", label: "NCS" },
              { key: "mygov", label: "MyGov" },
              { key: "drdo", label: "DRDO" },
              { key: "niti", label: "NITI Aayog" },
              { key: "maharashtra", label: "MahaSwayam" },
              { key: "bis", label: "BIS" },
              { key: "isro", label: "ISRO" },
              { key: "iocl", label: "IOCL" },
              { key: "ongc", label: "ONGC" },
              { key: "barc", label: "BARC" },
              { key: "nats", label: "NATS" },
              { key: "sebi", label: "SEBI" },
              { key: "tamil nadu", label: "TN Portal" },
            ].map((s) => {
              const active = selectedSources.includes(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => setSelectedSources((prev) => active ? prev.filter(x => x !== s.key) : [...prev, s.key])}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${active ? "bg-white/10 border-white/20" : "bg-white/5 border-card-border hover:bg-white/10"}`}
                >
                  {s.label}
                </button>
              );
            })}
            {selectedSources.length > 0 && (
              <button onClick={() => setSelectedSources([])} className="text-xs px-3 py-1.5 rounded-full border bg-white/5 border-card-border hover:bg-white/10">
                Clear
              </button>
            )}
            <div className="ml-auto text-xs text-muted-foreground">{resultCount} result{resultCount === 1 ? "" : "s"}</div>
          </div>
        </div>

        {error && <div className="text-sm text-rose-300 mb-4">{error}</div>}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
                <div className="h-4 w-2/3 bg-white/10 rounded mb-2" />
                <div className="h-3 w-1/2 bg-white/10 rounded mb-4" />
                <div className="h-3 w-full bg-white/10 rounded mb-1" />
                <div className="h-3 w-5/6 bg-white/10 rounded" />
                <div className="mt-4 h-8 w-24 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && resultCount === 0 && (
          <div className="glass-card rounded-2xl p-5">
            <div className="font-medium mb-2">No results</div>
            <p className="text-sm text-muted-foreground mb-3">Try clearing filters, selecting another state, or toggling sources. You can also try a fresh search to scrape the latest opportunities.</p>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="text-sm px-3 py-2 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20"
            >Search now</button>
          </div>
        )}

        {!loading && resultCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((job, i) => (
              <div key={job.id || i} className="relative">
                {/* Trust score badge (admin view) */}
                {isAdmin && typeof (job as any).trust_score === 'number' && (
                  <span className="absolute -top-2 -left-2 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">Trust {(job as any).trust_score}</span>
                )}
                <JobCard job={job} />
                {/* Eligibility CTA */}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const profile = (() => {
                          try { return JSON.parse(localStorage.getItem('onboarding') || 'null') || {}; } catch { return {}; }
                        })();
                        const r = await fetch(`${API_BASE}/api/gov/eligible`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job: job, profile: {
                          degree: profile?.branch || undefined,
                          year: Number(profile?.year) || undefined,
                          location: profile?.location || undefined,
                          skills: Array.isArray(profile?.skills) ? profile.skills : [],
                        } }) });
                        const d = await r.json();
                        alert(`${d.eligible ? 'Likely eligible' : 'May not be eligible'} (score: ${Math.round(d.score)}).\n${(d.reasons||[]).join('\n')}`);
                      } catch (e) {
                        alert('Could not check eligibility.');
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-card-border hover:bg-white/10"
                  >Am I eligible?</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Admin moderation panel */}
        {isAdmin && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold mb-2">Pending moderation (low trust)</h2>
            {modLoading && <div className="text-xs text-muted-foreground">Loading pending…</div>}
            {!modLoading && pending.length === 0 && <div className="text-xs text-muted-foreground">None pending.</div>}
            {!modLoading && pending.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pending.map((p, idx) => (
                  <div key={idx} className="glass-card rounded-2xl p-4 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm line-clamp-2">{p.title}</div>
                      {typeof p.trust_score === 'number' && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">{Math.round(p.trust_score)}</span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-1 line-clamp-2">{p.company} • {p.location}</div>
                    <div className="mt-2 line-clamp-3">{p.description}</div>
                    <div className="mt-3 flex items-center gap-2">
                      <a href={p.apply_url || p.url} target="_blank" className="text-xs underline">Open</a>
                      <button
                        onClick={async () => {
                          await fetch(`${API_BASE}/api/gov/mod/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: p.apply_url || p.url }) });
                          setRefreshKey(k => k + 1);
                        }}
                        className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      >Approve</button>
                      <button
                        onClick={async () => {
                          await fetch(`${API_BASE}/api/gov/mod/flag`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: p.apply_url || p.url }) });
                          setRefreshKey(k => k + 1);
                        }}
                        className="text-xs px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      >Flag</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
