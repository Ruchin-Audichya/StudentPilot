import { ArrowRight, BriefcaseBusiness, FileCheck2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const steps = [
  { icon: Search, title: 'Find live internships', body: 'Search StudentPilot sources, 12 job boards and company career pages. See which sources worked.' },
  { icon: FileCheck2, title: 'Tailor your PDF resume', body: 'Upload your resume once. Review a reconstructed LaTeX version and its PDF for each role.' },
  { icon: BriefcaseBusiness, title: 'Start a reviewed queue', body: 'Sign in to job sites in a local browser. StudentPilot fills known answers and stops when it needs you.' },
];

export default function LandingFocused() {
  return <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-0">
    <nav className="border-b border-card-border bg-background/90 sticky top-0 z-30 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="text-lg font-bold tracking-tight">StudentPilot</Link>
        <div className="flex items-center gap-4 text-sm"><Link className="hover:text-primary" to="/dashboard">Search</Link><Link className="hover:text-primary" to="/jobs">Applications</Link><Link className="hover:text-primary" to="/auth">Sign in</Link></div>
      </div>
    </nav>
    <main className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Internship search and applications</p>
          <h1 className="mt-4 text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05]">Your next internship, from search to submission.</h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">Find real openings, tailor your uploaded resume to each one, and fill applications in a visible browser. Keep every outcome in one tracker.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg" className="gradient-primary text-white"><Link to="/dashboard">Find internships <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/jobs">Open application workspace</Link></Button></div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3 pb-20">{steps.map(({ icon: Icon, title, body }, index) => <div key={title} className="rounded-2xl border border-card-border bg-card p-6">
        <div className="flex items-center justify-between"><span className="rounded-lg bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></span><span className="text-sm text-muted-foreground">0{index + 1}</span></div>
        <h2 className="mt-6 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>)}</section>
    </main>
  </div>;
}
