
import { useState } from "react";
import type { UserProfile } from "../types";

type Props = {
  initial?: Partial<UserProfile>;
  onSave: (profile: UserProfile) => Promise<void>;
};

export default function OnboardingForm({ initial, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const [remote, setRemote] = useState(initial?.remote_ok ?? true);
  const [location, setLocation] = useState(initial?.location_pref ?? "");

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    if (!skills.includes(s)) setSkills([...skills, s]);
    setSkillInput("");
  }
  function removeSkill(s: string) {
    setSkills(skills.filter(k => k !== s));
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-semibold mb-2">Quick Onboarding</h2>
      <p className="text-sm text-gray-500 mb-4">Tell us a bit about you so we can match better.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Your name" />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="you@example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium">Location Preference</label>
          <input value={location} onChange={e=>setLocation(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g., Jaipur" />
        </div>
        <div className="flex items-center gap-2">
          <input id="remote_ok" type="checkbox" checked={remote} onChange={e=>setRemote(e.target.checked)} />
          <label htmlFor="remote_ok" className="text-sm">Open to Remote</label>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium">Skills</label>
        <div className="flex gap-2 mt-2">
          <input
            value={skillInput}
            onChange={e=>setSkillInput(e.target.value)}
            onKeyDown={e=>{ if (e.key==='Enter'){ e.preventDefault(); addSkill(); } }}
            className="flex-1 border rounded px-3 py-2"
            placeholder="Type a skill and press Enter"
          />
          <button onClick={addSkill} className="border rounded px-3 py-2">Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {skills.map(s=> (
            <span key={s} className="text-sm bg-gray-100 px-2 py-1 rounded">
              {s} <button onClick={()=>removeSkill(s)} className="ml-1 text-gray-500 hover:text-black">×</button>
            </span>
          ))}
          {skills.length===0 && <span className="text-xs text-gray-400">No skills yet</span>}
        </div>
      </div>

      <div className="mt-4">
        <button
          className="bg-black text-white px-4 py-2 rounded"
          onClick={async ()=>{
            const profile: UserProfile = { name, email, skills, location_pref: location, remote_ok: remote, interests: [] };
            await onSave(profile);
          }}
        >
          Save Profile
        </button>
      </div>
    </div>
  );
}
