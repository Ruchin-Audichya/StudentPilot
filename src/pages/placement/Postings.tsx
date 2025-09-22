import { useEffect, useState } from "react";
import { placementApi } from "@/services/placement";

export default function PlacementPostings(){
  const [list, setList] = useState<any[]|null>(null);
  useEffect(()=>{ (async()=>{ try{ const rows=await placementApi.listPostings(); setList(rows);}catch{ setList([]);} })(); },[]);
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Placement Postings</h1>
        <a href="/admin/placements" className="text-sm text-sky-300 hover:text-sky-200">Admin Postings →</a>
      </header>
      {!list && <div className="glass-card rounded-2xl p-6 animate-pulse h-28"/>}
      {list && list.length===0 && <div className="glass-card rounded-2xl p-6 text-sm text-slate-300">No postings yet.</div>}
      <div className="grid gap-3">
        {list?.map(p => (
          <article key={p.id} className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-medium">{p.title}</div>
                <div className="text-sm text-slate-300">{p.company} · {p.role}</div>
              </div>
              <ApplyButton postingId={p.id} />
            </div>
            <p className="mt-2 text-sm text-slate-300 line-clamp-3">{p.description}</p>
            <div className="mt-3 flex gap-3 text-sm">
              <a className="text-sky-300 hover:text-sky-200" href={`/resume-genius?source=placement&postingId=${encodeURIComponent(p.id)}`} target="_blank" rel="noreferrer">Optimize Resume</a>
              <a className="text-sky-300 hover:text-sky-200" href={`/mock-interview?source=placement&role=${encodeURIComponent(p.role)}`} target="_blank" rel="noreferrer">Practice Interview</a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ApplyButton({ postingId }:{ postingId:string }){
  const [busy, setBusy] = useState(false);
  async function apply(){
    setBusy(true); try { await placementApi.apply(postingId, { resume_url: '' }); alert('Applied'); } catch(e:any){ alert(e?.message || 'Failed'); } finally { setBusy(false); }
  }
  return <button onClick={apply} disabled={busy} className={`px-3 py-1.5 rounded-lg border ${busy? 'opacity-60 cursor-wait' : 'hover:bg-white/5 border-white/10'}`}>{busy? 'Applying…' : 'Apply'}</button>;
}
