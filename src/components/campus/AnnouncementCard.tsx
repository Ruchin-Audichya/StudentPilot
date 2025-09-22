export default function AnnouncementCard({ a, onAck, onRead }:{ a:any; onAck:(id:string)=>Promise<void>|void; onRead:(id:string)=>Promise<void>|void; }){
  const read = Boolean(a.read_at);
  const ack = Boolean(a.acknowledged_at);
  return (
    <article className="glass-card rounded-2xl p-4 border border-card-border">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">{a.title}</h3>
          {a.tags?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {a.tags.map((t:string)=>(<span key={t} className="text-xs px-2 py-0.5 rounded-full border border-white/10 bg-white/5">{t}</span>))}
            </div>
          ): null}
        </div>
        {a.is_pinned ? <span className="text-xs px-2 py-0.5 rounded bg-white/10 border border-white/10">Pinned</span> : null}
      </header>
      <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{a.summary || a.body}</p>
      {a.attachments?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.attachments.map((u:string,i:number)=>(
            <a key={i} href={u} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 text-sm">Attachment {i+1}</a>
          ))}
        </div>
      ) : null}
      <footer className="mt-3 flex items-center gap-2">
        <button aria-pressed={read} onClick={()=>onRead(a.id)} className={`px-3 py-1.5 rounded-lg border transition ${read? 'bg-white/10 border-white/20' : 'hover:bg-white/5 border-white/10'}`}>{read? 'Read' : 'Mark Read'}</button>
        <button aria-pressed={ack} onClick={()=>onAck(a.id)} className={`px-3 py-1.5 rounded-lg border transition ${ack? 'bg-white/10 border-white/20' : 'hover:bg-white/5 border-white/10'}`}>{ack? 'Acknowledged' : 'Acknowledge'}</button>
      </footer>
    </article>
  );
}
