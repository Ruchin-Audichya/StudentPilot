
type Props = {
  query: string;
  setQuery: (s: string) => void;
  location: string;
  setLocation: (s: string) => void;
  remoteOK: boolean;
  setRemoteOK: (b: boolean) => void;
  limit: number;
  setLimit: (n: number) => void;
  onSearch: () => void;
};

export default function Filters({
  query, setQuery, location, setLocation, remoteOK, setRemoteOK, limit, setLimit, onSearch
}: Props) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">Filters</h3>
      <div className="grid gap-3 md:grid-cols-4 mt-2">
        <input value={query} onChange={e=>setQuery(e.target.value)} className="border rounded px-3 py-2" placeholder="Search query e.g., Machine Learning" />
        <input value={location} onChange={e=>setLocation(e.target.value)} className="border rounded px-3 py-2" placeholder="Location e.g., Jaipur" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remoteOK} onChange={e=>setRemoteOK(e.target.checked)} />
          Remote OK
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm">Limit</span>
          <input type="number" min={1} max={50} value={limit} onChange={e=>setLimit(parseInt(e.target.value||"20"))} className="w-20 border rounded px-2 py-1" />
        </div>
      </div>
      <div className="mt-3">
        <button className="bg-black text-white px-4 py-2 rounded" onClick={onSearch}>Search</button>
      </div>
    </div>
  );
}
