import React, { useState } from 'react';
import { getHrLinks, type HRLink } from '../services/linkedinTools';

export default function BackendDebugHrLinks() {
  const [skills, setSkills] = useState('python, react');
  const [roles, setRoles] = useState('software engineer');
  const [location, setLocation] = useState('India');
  const [links, setLinks] = useState<HRLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await getHrLinks({
        skills: skills.split(/[\s,]+/).map(s => s.trim()).filter(Boolean),
        roles: roles.split(/[\s,]+/).map(s => s.trim()).filter(Boolean),
        location: location.trim() || undefined,
        limit: 6,
      });
      setLinks(out);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-md space-y-3">
      <h3 className="font-semibold">LinkedIn HR Links (Debug)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label className="block text-sm">Skills</label>
          <input value={skills} onChange={e => setSkills(e.target.value)} className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block text-sm">Roles</label>
          <input value={roles} onChange={e => setRoles(e.target.value)} className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block text-sm">Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className="w-full border px-2 py-1 rounded" />
        </div>
      </div>
      <button onClick={run} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading}>Generate</button>
      {loading && <div className="text-sm">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <ul className="list-disc pl-5 space-y-1">
        {links.map((l, i) => (
          <li key={i}>
            <a href={l.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
