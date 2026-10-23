import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, SlidersHorizontal } from 'lucide-react';
import TopNav from '@/components/TopNav';
import JobCard from '@/components/JobCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchInternshipsExpanded, type JobResult, type SearchCoverage } from '@/services/jobApi';

type StudentProfile = { name: string; skills: string[]; interests: string[] };
type DashboardProps = { profile?: StudentProfile };

function uniqueJobs(jobs: JobResult[]) {
  const seen = new Set<string>();
  return jobs.filter(job => {
    const key = (job.url || `${job.title}|${job.company}`).toLowerCase().split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function savedProfile(): StudentProfile | null {
  try {
    const value = JSON.parse(localStorage.getItem('onboarding') || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

export default function FocusedDashboard({ profile }: DashboardProps) {
  const candidate = profile || savedProfile();
  const [role, setRole] = useState(candidate?.interests?.[0] || '');
  const [location, setLocation] = useState('India');
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [coverage, setCoverage] = useState<SearchCoverage[]>([]);
  const [source, setSource] = useState('All sources');
  const [paidOnly, setPaidOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const sources = useMemo(() => ['All sources', ...new Set(jobs.map(job => job.source || 'Other'))], [jobs]);
  const visible = useMemo(() => jobs.filter(job =>
    (source === 'All sources' || job.source === source) && (!paidOnly || Boolean(job.stipend))), [jobs, source, paidOnly]);

  async function search() {
    setBusy(true); setError(''); setSearched(true); setCoverage([]); setJobs([]); setSource('All sources');
    try {
      const result = await searchInternshipsExpanded({
        skills: Array.isArray(candidate?.skills) ? candidate.skills : [],
        interests: role.trim() ? [role.trim()] : [], location: location.trim() || 'India',
      }, found => setJobs(uniqueJobs(found)));
      setJobs(uniqueJobs(result.jobs)); setCoverage(result.coverage);
    } catch (cause) { setError((cause as Error).message || 'Search failed. Check the backend and try again.'); }
    finally { setBusy(false); }
  }

  return <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-10">
    <TopNav actions={[{ label: 'Search internships', to: '/dashboard' }]} />
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-7">
      <section className="rounded-3xl border border-card-border bg-gradient-to-br from-primary/15 via-background to-background p-6 sm:p-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">StudentPilot · internship search</p>
            <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">Find the role. Prepare the application.</h1>
            <p className="mt-3 text-muted-foreground">Search live listings from StudentPilot, 12 job boards and company career pages. Open a result to tailor your uploaded PDF and apply.</p>
          </div>
          <Button asChild className="gradient-primary text-white shrink-0"><Link to="/jobs">Open application workspace <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
        <form onSubmit={event => { event.preventDefault(); search(); }} className="mt-7 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <label className="text-sm font-medium">Internship role or skill<Input className="mt-1" placeholder="e.g. Frontend developer" value={role} onChange={event => setRole(event.target.value)} /></label>
          <label className="text-sm font-medium">Location<Input className="mt-1" placeholder="India or city" value={location} onChange={event => setLocation(event.target.value)} /></label>
          <Button className="md:self-end gradient-primary text-white" disabled={busy} type="submit"><Search className="mr-2 h-4 w-4" />{busy ? 'Searching sources…' : 'Search internships'}</Button>
        </form>
      </section>

      {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</div>}
      {coverage.length > 0 && <section className="rounded-2xl border border-card-border p-4">
        <h2 className="text-sm font-semibold">Source coverage</h2>
        <div className="mt-3 flex flex-wrap gap-2">{coverage.map(item => <span key={item.source} title={item.error || `${item.rejected} links skipped`} className={`rounded-full border px-2.5 py-1 text-xs ${item.error ? 'border-amber-500/40 text-amber-400' : 'border-card-border text-muted-foreground'}`}>{item.source}: {item.error || `${item.count} found`}</span>)}</div>
      </section>}

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h2 className="text-xl font-bold">Internships</h2><p className="text-sm text-muted-foreground">{searched ? `${visible.length} matching listings${busy ? ' · checking more sources…' : ''}` : 'Choose a role and search to see listings.'}</p></div>
          {jobs.length > 0 && <div className="flex items-center gap-3 text-sm"><SlidersHorizontal className="h-4 w-4" />
            <select aria-label="Filter by source" className="rounded-md border border-card-border bg-background px-2 py-2" value={source} onChange={event => setSource(event.target.value)}>{sources.map(value => <option key={value}>{value}</option>)}</select>
            <label className="flex items-center gap-2 whitespace-nowrap"><input type="checkbox" checked={paidOnly} onChange={event => setPaidOnly(event.target.checked)} />Paid only</label>
          </div>}
        </div>
        {!busy && searched && jobs.length === 0 && !error && <div className="rounded-2xl border border-card-border p-8 text-center text-muted-foreground">No verified internships were found. Try a broader role or location, and check the source coverage above.</div>}
        {jobs.length > 0 && visible.length === 0 && <div className="rounded-2xl border border-card-border p-6 text-muted-foreground">No listings match these filters.</div>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(job => <JobCard key={job.id || job.url} job={job} />)}</div>
      </section>
    </main>
  </div>;
}
