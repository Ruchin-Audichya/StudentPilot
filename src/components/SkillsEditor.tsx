
type Props = {
  skills: string[];
  setSkills: (skills: string[]) => void;
};

export default function SkillsEditor({ skills, setSkills }: Props) {
  let inputValue = "";
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">Skills</h3>
      <div className="flex gap-2 mt-2">
        <input
          id="skillInputBox"
          className="flex-1 border rounded px-3 py-2"
          placeholder="Add a skill and press Add"
          onChange={(e)=>{ inputValue = e.target.value; }}
        />
        <button
          className="border rounded px-3 py-2"
          onClick={()=>{
            const box = document.getElementById("skillInputBox") as HTMLInputElement | null;
            const v = (box?.value || "").trim();
            if (v && !skills.includes(v)) setSkills([...skills, v]);
            if (box) box.value = "";
          }}
        >Add</button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {skills.map(s=> (
          <span key={s} className="text-sm bg-gray-100 px-2 py-1 rounded">
            {s} <button onClick={()=>setSkills(skills.filter(k=>k!==s))} className="ml-1 text-gray-500 hover:text-black">×</button>
          </span>
        ))}
        {skills.length===0 && <span className="text-xs text-gray-400">No skills yet</span>}
      </div>
    </div>
  );
}
