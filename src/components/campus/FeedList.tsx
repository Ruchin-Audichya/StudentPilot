import AnnouncementCard from "./AnnouncementCard.tsx";

export default function FeedList({ announcements, loading, onAck, onRead }:{ announcements:any[]; loading?:boolean; onAck:(id:string)=>Promise<void>|void; onRead:(id:string)=>Promise<void>|void; }){
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({length:3}).map((_,i)=> (
          <div key={i} className="glass-card rounded-2xl p-4 animate-pulse h-28" />
        ))}
      </div>
    );
  }
  if (!announcements?.length) {
    return <div className="glass-card rounded-2xl p-6 text-sm text-slate-300">No announcements yet.</div>;
  }
  return (
    <div className="space-y-3">
      {announcements.map(a => (
        <AnnouncementCard key={a.id} a={a} onAck={onAck} onRead={onRead} />
      ))}
    </div>
  );
}
