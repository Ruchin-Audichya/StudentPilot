export function TargetChips({ value, onChange }:{ value:{dept?:string[]; year?:string[]}; onChange:(v:{dept?:string[]; year?:string[]})=>void }){
  const depts = ["CSE","ECE","DS","ME"]; const years = ["1","2","3","4"];
  const toggle = (k:'dept'|'year', v:string) => {
    const cur = new Set(value[k] || []);
    if (cur.has(v)) cur.delete(v); else cur.add(v);
    onChange({ ...value, [k]: Array.from(cur) });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {depts.map(d => (
          <button key={d} aria-pressed={value.dept?.includes(d)} onClick={()=>toggle('dept', d)} className={`px-3 py-1.5 rounded-lg border transition ${value.dept?.includes(d)? 'bg-white/10 border-white/20' : 'hover:bg-white/5 border-white/10'}`}>{d}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {years.map(y => (
          <button key={y} aria-pressed={value.year?.includes(y)} onClick={()=>toggle('year', y)} className={`px-3 py-1.5 rounded-lg border transition ${value.year?.includes(y)? 'bg-white/10 border-white/20' : 'hover:bg-white/5 border-white/10'}`}>Year {y}</button>
        ))}
      </div>
    </div>
  );
}
