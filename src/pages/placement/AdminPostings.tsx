import { useEffect, useState } from "react";
import { placementApi } from "@/services/placement";

export default function AdminPostings(){
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [appl, setAppl] = useState<any[]>([]);

  async function refresh(){ try{ const rows=await placementApi.listPostings(); setList(rows);}catch{ setList([]);} }
  useEffect(()=>{ refresh(); },[]);

  async function create(){
    if (!title || !company || !role) return;
    setBusy(true); try{ await placementApi.createPosting({ title, company, role, description }); setTitle(""); setCompany(""); setRole(""); setDescription(""); await refresh(); } finally { setBusy(false); }
  }

  async function openApplicants(id:string){
    setSel(id); try{ const rows=await placementApi.applicants(id); setAppl(rows);}catch{ setAppl([]); }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin — Placement Postings</h1>
        <a href="/placement" className="text-sm text-sky-300 hover:text-sky-200">← Student View</a>
      </header>
      <section className="glass-card rounded-2xl p-4 space-y-2">
        <div className="text-lg font-medium">New Posting</div>
        <div className="grid md:grid-cols-3 gap-2">
          <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10"/>
          <input placeholder="Company" value={company} onChange={e=>setCompany(e.target.value)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10"/>
          <input placeholder="Role" value={role} onChange={e=>setRole(e.target.value)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10"/>
        </div>
        <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 min-h-28"/>
        <button onClick={create} disabled={busy || !title || !company || !role} className={`px-3 py-1.5 rounded-lg border ${busy? 'opacity-60 cursor-wait' : 'hover:bg-white/5 border-white/10'}`}>{busy? 'Creating…' : 'Create'}</button>
      </section>
      <section className="grid gap-3">
        {list.map(p => (
          <article key={p.id} className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-medium">{p.title}</div>
                <div className="text-sm text-slate-300">{p.company} · {p.role}</div>
              </div>
              <button onClick={()=>openApplicants(p.id)} className="px-3 py-1.5 rounded-lg border hover:bg-white/5 border-white/10">Applicants</button>
            </div>
            {sel===p.id && (
              <div className="mt-3 grid gap-2">
                {appl.map(a => (<ApplicantRow key={a.id} a={a}/>))}
                {!appl.length && <div className="text-sm text-slate-300">No applicants yet.</div>}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function ApplicantRow({ a }:{ a:any }){
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  async function setStatus(status:string){ setBusy(true); try{ await placementApi.updateStatus(a.id, status); alert('Updated'); } finally { setBusy(false);} }
  async function schedule(){ if(!when) return; setBusy(true); try{ await placementApi.schedule(a.id, when); alert('Scheduled'); } finally { setBusy(false);} }
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm">Applicant: {a.user_id}</div>
          <div className="text-xs text-slate-400">Status: {a.status} {a.interview_at? `· Interview: ${a.interview_at}` : ''}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setStatus('shortlisted')} disabled={busy} className="px-2 py-1 rounded-lg border hover:bg-white/5 border-white/10 text-xs">Shortlist</button>
          <button onClick={()=>setStatus('rejected')} disabled={busy} className="px-2 py-1 rounded-lg border hover:bg-white/5 border-white/10 text-xs">Reject</button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-sm"/>
        <button onClick={schedule} disabled={busy || !when} className="px-2 py-1 rounded-lg border hover:bg-white/5 border-white/10 text-xs">Schedule Interview</button>
      </div>
    </div>
  );
}
