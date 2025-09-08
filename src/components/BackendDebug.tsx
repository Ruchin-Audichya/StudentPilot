import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/apiBase';

export default function BackendDebug() {
  const [state, setState] = useState<{health?: any; version?: any; error?: string}>({});
  useEffect(() => {
    let cancelled=false;
    async function load(){
      try {
        const [h,v] = await Promise.all([
          fetch(API_BASE + '/health').then(r=>r.json()),
          fetch(API_BASE + '/version').then(r=>r.json()).catch(()=>null),
        ]);
        if(!cancelled) setState({health:h, version:v});
      } catch(e:any){
        if(!cancelled) setState({error: e.message || String(e)});
      }
    }
    load();
    return ()=>{cancelled=true};
  }, []);
  return (
    <div style={{fontFamily:'monospace',fontSize:12, background:'#111', color:'#bbb', padding:8, borderRadius:8, lineHeight:1.3}}>
      <div>API_BASE = {API_BASE}</div>
      {state.error && <div style={{color:'#f55'}}>error: {state.error}</div>}
      {state.health && <div>health: {JSON.stringify(state.health)}</div>}
      {state.version && <div>version: {JSON.stringify(state.version)}</div>}
    </div>
  );
}
