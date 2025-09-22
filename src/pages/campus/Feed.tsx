import { useEffect, useMemo, useState } from "react";
import { campusApi } from "@/services/campus.ts";
import FeedList from "@/components/campus/FeedList.tsx";
import SegmentedToggle from "@/components/SegmentedToggle.tsx";

export default function CampusFeed() {
  const [loading, setLoading] = useState(true);
  const [ann, setAnn] = useState<any[]>([]);
  const [filter, setFilter] = useState<{scope: 'all'|'dept'|'year'|'unread'; dept?: string; year?: string}>({ scope: 'all' });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const profile = getProfile();
        const data = await campusApi.getFeed({
          dept: filter.scope==='dept'? (filter.dept || profile.dept) : undefined,
          year: filter.scope==='year'? (filter.year || profile.year) : undefined,
          unread: filter.scope==='unread' ? true : undefined,
        });
        if (alive) setAnn(data || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [filter]);

  useEffect(() => {
    const url = campusApi.streamUrl();
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      try { const data = JSON.parse(ev.data || '{}'); if (data?.type === 'new') {
        // refetch on new announcement
        setFilter(f=>({ ...f }));
      }} catch {}
    };
    return () => { es.close(); };
  }, []);

  const tabs = useMemo(() => ([
    { key: 'all', label: 'All' },
    { key: 'dept', label: 'Dept' },
    { key: 'year', label: 'Year' },
    { key: 'unread', label: 'Unread' },
  ] as const), []);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campus Feed</h1>
        <a href="/admin/console" className="text-sm text-sky-300 hover:text-sky-200">Admin Console →</a>
      </header>

      <div className="glass-card rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedToggle
            value={filter.scope}
            segments={tabs as any}
            onChange={(k)=>setFilter(f=>({ ...f, scope: k as any }))}
          />
          {filter.scope==='dept' && (
            <select className="px-3 py-1.5 rounded-lg bg-white/5 border border-card-border text-sm" value={filter.dept||''} onChange={(e)=>setFilter(f=>({...f, dept:e.target.value}))}>
              <option value="">Select Dept</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="DS">DS</option>
              <option value="ME">ME</option>
            </select>
          )}
          {filter.scope==='year' && (
            <select className="px-3 py-1.5 rounded-lg bg-white/5 border border-card-border text-sm" value={filter.year||''} onChange={(e)=>setFilter(f=>({...f, year:e.target.value}))}>
              <option value="">Select Year</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          )}
        </div>
      </div>

      <FeedList announcements={ann} loading={loading} onAck={async(id)=>{ await campusApi.ack(id); setAnn(a=>a.map(x=>x.id===id?{...x, acknowledged_at: new Date().toISOString()}:x)); }} onRead={async(id)=>{ await campusApi.read(id); setAnn(a=>a.map(x=>x.id===id?{...x, read_at: new Date().toISOString()}:x)); }} />
    </div>
  );
}

function getProfile(){
  try { return JSON.parse(localStorage.getItem('campus.profile')||'{}'); } catch { return {}; }
}
