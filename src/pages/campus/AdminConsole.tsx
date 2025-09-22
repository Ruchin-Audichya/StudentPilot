import AdminComposer from "@/components/campus/AdminComposer.tsx";
import { useEffect, useMemo, useState } from "react";
import { campusApi } from "@/services/campus.ts";
import SegmentedToggle from "@/components/SegmentedToggle.tsx";

export default function AdminConsole(){
  const [stats, setStats] = useState<{reads:number; acks:number} | null>(null);
  const [segments, setSegments] = useState<any | null>(null);
  const [tab, setTab] = useState<'draft'|'scheduled'|'published'>('published');
  const [list, setList] = useState<any[]>([]);
  const [preview, setPreview] = useState(false);
  useEffect(()=>{ (async()=>{ try{ const s = await campusApi.analytics(); setStats(s);}catch{ setStats({reads:0,acks:0}); } })(); },[]);
  useEffect(()=>{ (async()=>{ try{ const seg = await campusApi.analyticsSegments(); setSegments(seg);}catch{ setSegments(null); } })(); },[]);
  useEffect(()=>{ (async()=>{ try{ const rows = await campusApi.listAnnouncements(tab); setList(rows);}catch{ setList([]); } })(); },[tab]);
  const csv = useMemo(()=>{
    if (!segments) return '';
    const lines: string[] = ["segment,type,reads,acks"]; 
    for (const [k,v] of Object.entries(segments.by_department||{})) lines.push(`${k},department,${(v as any).reads},${(v as any).acks}`);
    for (const [k,v] of Object.entries(segments.by_year||{})) lines.push(`${k},year,${(v as any).reads},${(v as any).acks}`);
    return lines.join('\n');
  },[segments]);
  const exportCsv = () => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'analytics.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Console</h1>
        <a href="/feed" className="text-sm text-sky-300 hover:text-sky-200">← Back to Feed</a>
      </header>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-sm text-slate-300">Reads (24h)</div>
          <div className="text-2xl font-semibold">{stats?.reads ?? '—'}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-sm text-slate-300">Acknowledgements</div>
          <div className="text-2xl font-semibold">{stats?.acks ?? '—'}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-sm text-slate-300">Analytics (CSV)</div>
          <button onClick={exportCsv} className="mt-2 px-3 py-1.5 rounded-lg border hover:bg-white/5 border-white/10 text-sm">Export</button>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <SegmentedToggle
            value={tab}
            segments={[
              { key: 'draft', label: 'Draft' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'published', label: 'Published' },
            ] as any}
            onChange={(k)=>setTab(k as any)}
          />
          <label className="ml-auto inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={preview} onChange={e=>setPreview(e.target.checked)} /> Preview as student</label>
        </div>
        <div className="mt-3 grid gap-2">
          {list.map(item => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-slate-300">Status: {item.status}</div>
            </div>
          ))}
          {!list.length && <div className="text-sm text-slate-300">No items in {tab}.</div>}
        </div>
      </div>
      <AdminComposer />
    </div>
  );
}
