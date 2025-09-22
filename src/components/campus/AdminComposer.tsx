import { useState } from "react";
import { campusApi } from "@/services/campus";
import { TargetChips } from "./TargetChips";

export default function AdminComposer(){
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<{dept?:string[]; year?:string[]}>({});
  const [pin, setPin] = useState(false);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const canPost = title.trim().length>0 && body.trim().length>0 && !busy;

  async function submit(){
    if (!canPost) return;
    setBusy(true);
    try {
      await campusApi.create({ title, body, target, is_pinned: pin, scheduled_at: when || undefined, attachments: [] });
      setTitle(""); setBody(""); setTarget({}); setPin(false); setWhen("");
      alert("Announcement created");
    } catch (e:any) {
      alert(e?.message || "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-card rounded-2xl p-4 space-y-3">
      <h2 className="text-lg font-medium">New Announcement</h2>
      <input className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 min-h-32" placeholder="Write the announcement..." value={body} onChange={e=>setBody(e.target.value)} />
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-sm text-slate-300 mb-1">Target</div>
          <TargetChips value={target} onChange={setTarget} />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Schedule (optional)</label>
          <input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 w-full" />
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={pin} onChange={e=>setPin(e.target.checked)} /> Pin announcement</label>
        </div>
      </div>
      <div>
        <button onClick={submit} disabled={!canPost} className={`px-4 py-2 rounded-lg border ${canPost? 'hover:bg-white/5 border-white/10' : 'opacity-50 cursor-not-allowed border-white/10'}`}>{busy? 'Posting…' : 'Post Announcement'}</button>
      </div>
    </section>
  );
}
