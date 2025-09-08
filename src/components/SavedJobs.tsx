
import type { Internship } from "../types";

type Props = {
  items: Internship[];
  onRemove: (id: string) => void;
};

export default function SavedJobs({ items, onRemove }: Props) {
  if (items.length === 0) {
    return <div className="p-4 border rounded-lg text-sm text-gray-500">No saved internships yet.</div>;
  }
  return (
    <div className="space-y-3">
      {items.map(it => (
        <div key={it.id} className="p-3 border rounded flex items-center justify-between">
          <div className="text-sm">
            <div className="font-medium">{it.title}</div>
            <div className="text-gray-600">{it.company}{it.location?` • ${it.location}`:""}</div>
          </div>
          <div className="flex items-center gap-2">
            <a href={it.apply_url || "#"} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">Open</a>
            <button className="text-sm border px-2 py-1 rounded" onClick={()=>onRemove(it.id)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}
