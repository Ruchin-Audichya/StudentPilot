import { useState } from 'react';
import { Link } from 'react-router-dom';
import TopNav from '@/components/TopNav';
import { Megaphone, Landmark, Briefcase, Sparkles, Bot } from 'lucide-react';
import SegmentedToggle from '@/components/SegmentedToggle.tsx';

export default function CampusHub(){
  const [mode, setMode] = useState<'student'|'admin'>('student');
  return (
    <div className="min-h-screen bg-background text-foreground with-mobile-tabbar">
      <TopNav />
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Ambient gradient */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(99,102,241,0.18),transparent_60%)]"/>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-4 relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-white/5 px-3 py-1 text-xs text-muted-foreground">
            Campus · Live updates
          </div>
          <div className="mt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Campus Connect</h1>
              <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">Announcements, government programs, and placements — all in one place. Polished to match your Find My Stipend experience.</p>
            </div>
            {/* Segmented control */}
            <SegmentedToggle
              value={mode}
              segments={[
                { key: 'student', label: 'Student' },
                { key: 'admin', label: 'Admin' },
              ]}
              onChange={(k)=>setMode(k as 'student'|'admin')}
            />
          </div>
        </div>
      </section>

      {/* Grids */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10 relative">
        {mode==='student' ? <StudentGrid/> : <AdminGrid/>}

        {/* Extras */}
        {mode==='student' && (
          <div className="mt-10">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Career Boosters</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MiniCard icon={<Sparkles size={18}/>} title="Resume Genius" desc="Optimize your resume before you apply" to="/resume-genius?source=campus"/>
              <MiniCard icon={<Bot size={18}/>} title="Mock Interview" desc="Practice interviews for your target role" to="/mock-interview?source=campus"/>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ icon, title, desc, to, cta="Open" }: { icon: JSX.Element; title:string; desc:string; to:string; cta?:string }){
  return (
    <div className="group relative rounded-2xl border border-card-border bg-white/5 p-5 transition hover:bg-white/10">
      {/* subtle gradient ring */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition" style={{ background: "radial-gradient(400px 120px at 20% -20%, rgba(99,102,241,.15), transparent 60%)" }} />
      <div className="relative flex items-start gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground mt-1">{desc}</div>
          <div className="mt-3">
            <Link to={to} className="px-3 py-1.5 rounded-lg border border-card-border bg-white/5 hover:bg-white/10 text-sm inline-flex">{cta}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ icon, title, desc, to }: { icon: JSX.Element; title:string; desc:string; to:string }){
  return (
    <Link to={to} className="rounded-xl border border-card-border bg-white/5 p-4 hover:bg-white/10 transition block">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">{icon}</span>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

function StudentGrid(){
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card icon={<Megaphone size={18}/>} title="Announcements Feed" desc="Latest campus updates targeted to you" to="/feed"/>
      <Card icon={<Landmark size={18}/>} title="Gov Snapshot" desc="Verified government programs and opportunities" to="/campus/gov"/>
      <Card icon={<Briefcase size={18}/>} title="Placement Postings" desc="Browse and apply to active campus postings" to="/placement"/>
    </div>
  );
}

function AdminGrid(){
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card icon={<Megaphone size={18}/>} title="Admin Console" desc="Compose, schedule, and pin announcements" to="/admin/console" cta="Open Console"/>
      <Card icon={<Briefcase size={18}/>} title="Admin Placements" desc="Create postings, shortlist, and schedule interviews" to="/admin/placements" cta="Manage"/>
    </div>
  );
}
