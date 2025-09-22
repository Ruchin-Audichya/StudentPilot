import { useEffect, useState } from 'react';
import { campusApi } from '@/services/campus';
import { placementApi } from '@/services/placement';

type Toast = { id: string; text: string; ts: number };

export default function NotificationCenter(){
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(()=>{
    const es1 = new EventSource(campusApi.streamUrl());
    const es2 = new EventSource(placementApi.streamUrl());
    const push = (text:string)=>{
      const t = { id: crypto.randomUUID(), text, ts: Date.now() };
      setToasts(prev => [...prev, t].slice(-5));
      setTimeout(()=> setToasts(prev => prev.filter(x=>x.id!==t.id)), 5000);
    };
    es1.onmessage = (e)=>{ try{ const d=JSON.parse(e.data); push(d.message || 'Campus update'); }catch{ push('Campus update'); } };
    es2.onmessage = (e)=>{ try{ const d=JSON.parse(e.data); push(d.message || 'Placement update'); }catch{ push('Placement update'); } };
    es1.onerror = ()=>{ /* ignore */ };
    es2.onerror = ()=>{ /* ignore */ };
    return ()=>{ es1.close(); es2.close(); };
  },[]);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className="rounded-xl bg-black/70 text-white px-4 py-2 shadow-lg border border-white/10 text-sm">
          {t.text}
        </div>
      ))}
    </div>
  );
}
