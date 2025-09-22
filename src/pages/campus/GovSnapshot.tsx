import { useEffect, useMemo, useState } from 'react';
import TopNav from '@/components/TopNav';
import JobCard from '@/components/JobCard';
import { fetchGovFeeds } from '@/services/gov';

export default function GovSnapshot(){
  const qp = new URLSearchParams(location.search);
  const [stateFilter, setStateFilter] = useState<string>((qp.get('state')||'')==='All' ? '' : (qp.get('state')||''));
  const [onlyVerified, setOnlyVerified] = useState<boolean>((qp.get('verified')||'true')==='true');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(()=>{ (async()=>{
    setLoading(true); setError(null);
    try{
      const rows = await fetchGovFeeds({ state: stateFilter||undefined, only_verified: onlyVerified, limit: 100, force: refreshKey>0 });
      setItems(Array.isArray(rows)? rows: []);
    }catch(e:any){ setError(e?.message||'Failed to load feeds'); setItems([]);} finally{ setLoading(false); }
  })(); },[stateFilter, onlyVerified, refreshKey]);

  const resultCount = items.length;
  const commonStates = ["All","Rajasthan","Maharashtra","Delhi","Karnataka","Tamil Nadu","Gujarat"];

  return (
    <div className="min-h-screen bg-background text-foreground with-mobile-tabbar">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold">Government Snapshot</h1>
          <p className="text-sm text-muted-foreground">Find official internship opportunities aggregated from AICTE, NCS, MyGov, DRDO, and state portals. Scored using your uploaded resume.</p>
        </header>

        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 mb-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">State</label>
            <select value={stateFilter || 'All'} onChange={e=> setStateFilter(e.target.value==='All'?'':e.target.value)} className="text-sm bg-white/5 border border-card-border rounded-md px-2 py-1">
              {commonStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyVerified} onChange={(e)=> setOnlyVerified(e.target.checked)} />
            Show only verified
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={()=> setRefreshKey(k=>k+1)} disabled={loading} aria-busy={loading} className="text-sm px-3 py-2 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 disabled:opacity-60">{loading? 'Searching…':'Refresh (live)'}</button>
          </div>
        </div>

        {error && <div className="text-sm text-rose-300 mb-3">{error}</div>}

        {/* Results using JobCard for consistency */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({length:6}).map((_,i)=> (
              <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
                <div className="h-4 w-2/3 bg-white/10 rounded mb-2"/>
                <div className="h-3 w-1/2 bg-white/10 rounded mb-4"/>
                <div className="h-3 w-full bg-white/10 rounded mb-1"/>
                <div className="h-3 w-5/6 bg-white/10 rounded"/>
                <div className="mt-4 h-8 w-24 bg-white/10 rounded"/>
              </div>
            ))}
          </div>
        )}

        {!loading && resultCount === 0 && (
          <div className="glass-card rounded-2xl p-5">
            <div className="font-medium mb-2">No results</div>
            <p className="text-sm text-muted-foreground mb-3">Try another state or disable the verified filter, or hit Refresh for a new live scrape.</p>
            <button onClick={()=> setRefreshKey(k=>k+1)} className="text-sm px-3 py-2 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20">Refresh</button>
          </div>
        )}

        {!loading && resultCount > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((job:any)=> (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
