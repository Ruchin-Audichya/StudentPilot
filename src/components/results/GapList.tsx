import React from "react";

interface Gap {
  skill: string;
  note?: string;
}

interface PlanItem {
  day: string;
  task: string;
  resource?: string;
}

interface GapListProps {
  gaps: Gap[];
  plan: PlanItem[];
}

const GapList: React.FC<GapListProps> = ({ gaps, plan }) => (
  <div className="gap-list p-4">
    <div className="gap-section mb-4">
      <div className="font-bold text-lg mb-2">Top Gaps</div>
      <ul className="list-disc pl-5">
        {gaps.map((g, i) => (
          <li key={g.skill + i} className="mb-1">
            <span className="font-semibold">{g.skill}</span>
            {g.note && <span className="ml-2 text-xs text-slate-400 italic">{g.note}</span>}
          </li>
        ))}
      </ul>
    </div>
    <div className="gap-section">
      <div className="font-bold text-lg mb-2">2-Week Plan</div>
      <table className="gap-table w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left py-1 px-2 border-b border-slate-600">Day</th>
            <th className="text-left py-1 px-2 border-b border-slate-600">Task</th>
            <th className="text-left py-1 px-2 border-b border-slate-600">Resource</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((p, i) => (
            <tr key={p.day + i}>
              <td className="py-1 px-2 border-b border-slate-800">{p.day}</td>
              <td className="py-1 px-2 border-b border-slate-800">{p.task}</td>
              <td className="py-1 px-2 border-b border-slate-800">{p.resource || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default GapList;
