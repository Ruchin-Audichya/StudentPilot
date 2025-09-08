
import type { Internship } from "../types";

type Props = {
  items: Internship[];
  onSave: (job: Internship) => void;
};

function scoreBadge(score?: number) {
  if (score === undefined || score === null) return "Match: –";
  if (score >= 0.8) return `🔥 Great match (${Math.round(score*100)}%)`;
  if (score >= 0.5) return `✅ Good match (${Math.round(score*100)}%)`;
  return `🙂 Light match (${Math.round(score*100)}%)`;
}

export default function JobList({ items, onSave }: Props) {
  if (items.length === 0) {
    return <div className="p-4 border rounded-lg text-sm text-gray-500">No results yet. Try searching.</div>;
  }
  return (
    <div className="space-y-3">
      {items.map(it => (
        <div key={`${it.source}-${it.id}`} className="p-4 border rounded-lg">
          <div className="flex justify-between gap-4">
            <div>
              <h4 className="font-semibold">{it.title}</h4>
              <div className="text-sm text-gray-600">{it.company} {it.location ? `• ${it.location}` : ""}</div>
              <div className="text-sm mt-1">{scoreBadge(it.score)}</div>
              {it.tags?.length ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {it.tags.slice(0,8).map(t=> <span key={t} className="text-xs bg-gray-100 px-2 py-1 rounded">{t}</span>)}
                </div>
              ) : null}
              {it.description ? <p className="text-sm text-gray-700 mt-2 line-clamp-3">{it.description}</p> : null}
            </div>
            <div className="flex flex-col gap-2 items-end">
              {it.stipend ? <div className="text-sm font-medium">{it.stipend}</div> : <div className="text-sm text-gray-400">Stipend: N/A</div>}
              <a href={it.apply_url || "#"} target="_blank" rel="noreferrer" className="bg-black text-white px-3 py-2 rounded">Apply</a>
              <button className="border px-3 py-2 rounded" onClick={()=>onSave(it)}>Save</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
