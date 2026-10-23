import { useEffect, useMemo, useState } from 'react';
import TopNav from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ExternalLink, FileText, Search, Upload, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Application, hasLocalToken, Health, Job, JobState, jobFile, jobPost, jobRequest, saveLocalToken } from '@/lib/jobs';

const emptyProfile = {
  fullName: '', firstName: '', lastName: '', email: '', phone: '', linkedin: '', portfolio: '',
  role: '', location: '', facts: '', answers: {} as Record<string, string | boolean>,
};
const statusNames: Record<string, string> = {
  needs_compile: 'Compile LaTeX', needs_review: 'Review PDF', ready: 'Ready to apply',
  needs_input: 'Needs your input', submitting: 'Submitting', submitted: 'Submitted',
  submission_unknown: 'Check submission', submitted_manually: 'Submitted by you',
};

function selectedDescription() {
  try {
    const selected = JSON.parse(sessionStorage.getItem('studentpilot.selectedJob') || '{}');
    const url = new URLSearchParams(window.location.search).get('url');
    const description = String(selected.description || '');
    return selected.url === url && description.length >= 100 ? description : '';
  } catch { return ''; }
}

function FileLink({ name, label, preview = false }: { name: string; label: string; preview?: boolean }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const open = async () => {
    try {
      const url = await jobFile(name);
      if (preview) { setPreviewUrl(url); return; }
      const element = document.createElement('a');
      element.href = url;
      element.download = name;
      document.body.append(element); element.click(); element.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { toast.error((error as Error).message); }
  };
  return <><Button type="button" variant="outline" size="sm" onClick={open}>{label}</Button>
    <Dialog open={Boolean(previewUrl)} onOpenChange={next => { if (!next) { URL.revokeObjectURL(previewUrl); setPreviewUrl(''); } }}>
      <DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        {previewUrl && <iframe title={label} src={previewUrl} className="w-full h-[75vh] bg-white" />}
      </DialogContent>
    </Dialog></>;
}

export default function JobSearch() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState('');
  const [state, setState] = useState<JobState | null>(null);
  const [localToken, setLocalToken] = useState('');
  const [profile, setProfile] = useState(emptyProfile);
  const [answerLabel, setAnswerLabel] = useState('');
  const [answerValue, setAnswerValue] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('India');
  const [careerDomains, setCareerDomains] = useState('careers.google.com, microsoft.com, amazon.jobs, careers.meta.com, jobs.apple.com, jobs.netflix.com, careers.atlassian.com, careers.adobe.com, razorpay.com, phonepe.com');
  const [sources, setSources] = useState<string[]>([]);
  const [importUrl, setImportUrl] = useState(new URLSearchParams(window.location.search).get('url') || '');
  const [importTitle, setImportTitle] = useState(new URLSearchParams(window.location.search).get('title') || '');
  const [importCompany, setImportCompany] = useState(new URLSearchParams(window.location.search).get('company') || '');
  const [importDescription, setImportDescription] = useState(selectedDescription);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [latex, setLatex] = useState('');
  const [manualReceipt, setManualReceipt] = useState('');
  const [searchText, setSearchText] = useState('');
  const [queueMessage, setQueueMessage] = useState('');

  const refresh = async () => {
    const next = await jobRequest<JobState>('/state');
    setState(next);
    if (Object.keys(next.profile).length) setProfile({ ...emptyProfile, ...next.profile } as typeof emptyProfile);
  };
  useEffect(() => {
    jobRequest<Health>('/health').then(h => { setHealth(h); setSources(h.platforms.map(p => p.id)); }).catch(() => setHealthError('The local job service is not running.'));
    if (hasLocalToken()) refresh().catch(e => setError(e.message));
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('onboarding') || '{}');
      setProfile(p => ({ ...p, fullName: saved.name || '', role: saved.interests?.[0] || '', location: saved.location || 'India' }));
      setRole(saved.interests?.[0] || '');
    } catch { /* Onboarding is optional. */ }
  }, []);
  useEffect(() => {
    if (health?.authMode === 'firebase') refresh().catch(e => setError(e.message));
  }, [health?.authMode]);
  const run = async (key: string, action: () => Promise<JobState>) => {
    setBusy(key); setError('');
    try {
      const next = await action(); setState(next);
      if (key === 'tailor' || key === 'compile') {
        const id = selectedId;
        if (id) {
          const url = await jobFile(`${id}.tex`);
          setLatex(await (await fetch(url)).text()); URL.revokeObjectURL(url);
        }
      }
      toast.success('Updated');
    }
    catch (e) { setError((e as Error).message); toast.error((e as Error).message); }
    finally { setBusy(''); }
  };
  const selectedJob = state?.jobs.find(j => j.id === selectedId);
  const selectedApplication = state?.applications.find(a => a.jobId === selectedId);
  const filteredJobs = useMemo(() => (state?.jobs || []).filter(job =>
    `${job.title} ${job.company} ${job.source}`.toLowerCase().includes(searchText.toLowerCase())), [state?.jobs, searchText]);
  const selectJob = async (job: Job) => {
    setSelectedId(job.id); setLatex(''); setManualReceipt('');
    if (state?.applications.some(a => a.jobId === job.id)) {
      try {
        const url = await jobFile(`${job.id}.tex`);
        setLatex(await (await fetch(url)).text()); URL.revokeObjectURL(url);
      } catch { /* LaTeX may not have been generated yet. */ }
    }
  };
  const addAnswer = () => {
    if (!answerLabel.trim()) return;
    setProfile(p => ({ ...p, answers: { ...p.answers, [answerLabel.trim()]: answerValue.trim() } }));
    setAnswerLabel(''); setAnswerValue('');
  };
  const exportApplications = () => {
    if (!state) return;
    const columns = ['Job_ID', 'Company', 'Position', 'Status', 'Applied_Date', 'Last_Checked', 'Application_ID', 'Notes', 'Job_URL', 'Source'];
    const rows = state.jobs.map(job => {
      const application = state.applications.find(item => item.jobId === job.id);
      return [job.id, job.company, job.title, application?.status || 'Not Applied', application?.receipt?.observedAt || '',
        application?.receipt?.observedAt || '', application?.receipt?.text || '', application?.message || '', job.url, job.source];
    });
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'studentpilot-applications.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const prepareQueue = () => {
    const ids = (state?.jobs || []).filter(job => !state?.applications.some(a => a.jobId === job.id)).slice(0, 10).map(job => job.id);
    if (!ids.length) return setQueueMessage('Find or import jobs before preparing resumes.');
    setQueueMessage('Preparing resumes one by one. Review each PDF before applying.');
    run('prepare', () => jobPost('/queue/prepare', { jobIds: ids }));
  };
  const runReviewed = () => {
    const ids = (state?.applications || []).filter(a => a.status === 'ready').slice(0, 10).map(a => a.jobId);
    if (!ids.length) return setQueueMessage('Review and approve at least one tailored PDF first.');
    setQueueMessage('Submitting reviewed applications one by one. The run pauses if a form needs you.');
    run('run-reviewed', () => jobPost('/run-reviewed', { jobIds: ids }));
  };

  if (!health) return <div className="min-h-screen bg-background"><TopNav actions={[{ label: 'Search internships', to: '/dashboard' }]} />
    <main className="mx-auto max-w-3xl px-4 py-16"><Card><CardHeader><CardTitle>Start the application workspace</CardTitle><CardDescription>{healthError || 'Connecting to the local job service…'}</CardDescription></CardHeader>
      <CardContent className="space-y-4 text-sm"><p>Account sign-in and autofill use a visible browser on your computer. Start the service in this repository, then reopen this page.</p>
        <pre className="rounded-lg bg-muted p-4 overflow-x-auto">npm run jobs:server</pre>
        <p>Set <code>ENABLE_APPLICATION_BROWSER=true</code> and the server-side keys described in <code>docs/job-automation.md</code>.</p>
        <Button onClick={() => window.location.reload()}>Retry connection</Button>
      </CardContent></Card></main></div>;

  return <div className="min-h-screen bg-background">
    <TopNav actions={[{ label: 'Dashboard', to: '/dashboard' }]} />
    <main className="container mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Internship Autopilot</h1>
        <p className="text-muted-foreground mt-1">Find real listings, connect job-site sessions, prepare tailored resumes from your PDF, and start a reviewed application queue.</p>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {health?.authMode === 'local' && !state && <Card><CardHeader><CardTitle>Connect to the local job service</CardTitle><CardDescription>Paste the access token printed by <code>npm run jobs:server</code>.</CardDescription></CardHeader>
        <CardContent className="flex gap-2"><Input aria-label="Local access token" type="password" value={localToken} onChange={e => setLocalToken(e.target.value)} />
          <Button onClick={() => { saveLocalToken(localToken); refresh().catch(e => setError(e.message)); }}>Connect</Button></CardContent></Card>}
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant={health.search ? 'default' : 'outline'}>Job search {health.search ? 'ready' : 'needs Brave key'}</Badge>
        <Badge variant={health.tailoring ? 'default' : 'outline'}>PDF tailoring {health.tailoring ? 'ready' : 'needs OpenAI key'}</Badge>
        <Badge variant={health.compiler ? 'default' : 'outline'}>LaTeX compiler {health.compiler ? 'ready' : 'needs image'}</Badge>
        <Badge variant={health.browser ? 'default' : 'outline'}>Browser {health.browser ? 'ready' : 'disabled'}</Badge>
      </div>

      <Card><CardHeader><CardTitle>Connect job-site accounts</CardTitle><CardDescription>Choose a site to open a visible local browser. Sign in there directly; StudentPilot does not ask for or save job-site passwords. A session marked “opened” still needs you to complete sign-in in the browser.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{health?.platforms.map(site => <div key={site.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
            <div><strong className="text-sm">{site.name}</strong><p className="text-xs text-muted-foreground">{state?.connections?.[site.id] ? 'Sign-in opened before' : 'Session not opened'}</p></div>
            <Button size="sm" variant="outline" disabled={Boolean(busy) || !health.browser} onClick={() => run(`connect-${site.id}`, () => jobPost(`/connections/${site.id}`, {}))}>Open sign-in</Button>
          </div>)}</div>
          {!health?.browser && <p className="text-xs text-amber-500">Account sessions and autofill need the local job service with its visible browser enabled.</p>}
        </CardContent></Card>

      <Card><CardHeader><CardTitle>1. Your resume and application details</CardTitle><CardDescription>Facts and answers are used only for your application. Review every tailored PDF before submitting.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {([['fullName','Full name'],['firstName','First name'],['lastName','Last name'],['email','Email'],['phone','Phone'],['linkedin','LinkedIn URL'],['portfolio','Portfolio URL'],['role','Target role'],['location','Location']] as const).map(([key,label]) =>
              <label key={key} className="space-y-1"><span className="text-sm font-medium">{label}</span><Input value={profile[key]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} /></label>)}
          </div>
          <label className="block space-y-1"><span className="text-sm font-medium">Confirmed background and preferences</span><Textarea value={profile.facts} onChange={e => setProfile(p => ({ ...p, facts: e.target.value }))} placeholder="Only facts you can verify: roles, projects, education, work authorization, notice period..." /></label>
          <div><Label>Answers for application questions</Label><p className="text-xs text-muted-foreground mb-2">Use the exact question label from a form. Leave uncertain questions to answer in the browser.</p>
            <div className="flex flex-wrap gap-2"><Input className="flex-1 min-w-48" placeholder="Question label" value={answerLabel} onChange={e => setAnswerLabel(e.target.value)} />
              <Input className="flex-1 min-w-48" placeholder="Your answer" value={answerValue} onChange={e => setAnswerValue(e.target.value)} /><Button type="button" variant="outline" onClick={addAnswer}>Add answer</Button></div>
            <div className="flex flex-wrap gap-2 mt-2">{Object.entries(profile.answers).map(([label,value]) => <Badge key={label} variant="outline" className="cursor-pointer" onClick={() => setProfile(p => { const answers = { ...p.answers }; delete answers[label]; return { ...p, answers }; })}>{label}: {String(value)} ×</Badge>)}</div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Button disabled={Boolean(busy)} onClick={() => run('profile', () => jobPost('/profile', profile))}>Save details</Button>
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm"><Upload className="h-4 w-4" />Upload PDF resume
              <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e => {
                const file = e.target.files?.[0]; if (!file) return;
                const form = new FormData(); form.append('resume', file);
                run('upload', () => jobRequest<JobState>('/resume', { method: 'POST', body: form }));
              }} /></label>
            {state?.resume && <><span className="text-sm text-muted-foreground"><FileText className="h-4 w-4 inline mr-1" />{state.resume.name}</span><FileLink name="original.pdf" label="Preview original" preview /></>}
          </div>
        </CardContent></Card>

      <Card><CardHeader><CardTitle>2. Find jobs</CardTitle><CardDescription>Search results show only readable job pages; coverage errors are listed below. You can also import a direct job URL.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2"><label><span className="text-sm font-medium">Role</span><Input value={role} onChange={e => setRole(e.target.value)} /></label><label><span className="text-sm font-medium">Location</span><Input value={location} onChange={e => setLocation(e.target.value)} /></label></div>
          <div><Label>Job boards</Label><div className="flex flex-wrap gap-2 mt-2">{health?.platforms.map(p => <label key={p.id} className="flex items-center gap-1 border rounded-md px-2 py-1 text-xs"><input type="checkbox" checked={sources.includes(p.id)} onChange={e => setSources(current => e.target.checked ? [...current,p.id] : current.filter(x => x !== p.id))} />{p.name}</label>)}</div></div>
          <label className="block"><span className="text-sm font-medium">Company career domains, comma separated</span><Input placeholder="careers.google.com, jobs.lever.co" value={careerDomains} onChange={e => setCareerDomains(e.target.value)} /></label>
          <Button disabled={Boolean(busy) || !role.trim() || !health.search} onClick={() => run('search', () => jobPost('/search', { role, location, sources, careerDomains: careerDomains.split(',').map(s => s.trim()).filter(Boolean) }))}><Search className="h-4 w-4 mr-2" />Search</Button>
          {state?.coverage?.length ? <div className="text-sm border rounded-lg p-3"><p className="font-medium mb-2">Search coverage</p><div className="flex flex-wrap gap-2">{state.coverage.map(c => <Badge key={c.source} variant={c.error ? 'destructive' : 'outline'} title={c.error || `${c.rejected} links skipped`}>{c.source}: {c.error ? 'error' : c.count}</Badge>)}</div></div> : null}
          <div className="border-t pt-4 space-y-2"><p className="font-medium">Import a direct job</p><Input placeholder="https://company.com/careers/job/123" value={importUrl} onChange={e => setImportUrl(e.target.value)} />
            <div className="grid gap-2 md:grid-cols-2"><Input placeholder="Title (for pages that cannot be parsed)" value={importTitle} onChange={e => setImportTitle(e.target.value)} /><Input placeholder="Company" value={importCompany} onChange={e => setImportCompany(e.target.value)} /></div>
            <Textarea placeholder="Paste the full job description if the page cannot be parsed" value={importDescription} onChange={e => setImportDescription(e.target.value)} />
            <Button variant="outline" disabled={!importUrl || Boolean(busy)} onClick={() => run('import', () => jobPost('/import', { url: importUrl, title: importTitle || undefined, company: importCompany || undefined, description: importDescription || undefined }))}>Import job</Button></div>
        </CardContent></Card>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>3. Start automation</CardTitle><CardDescription>Prepare up to 10 jobs, check each tailored PDF, then submit approved applications one at a time. The run stops when a site asks for sign-in, a CAPTCHA, an unknown answer, or a manual step.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3"><Button disabled={Boolean(busy) || !state?.resume || !state.jobs.length} onClick={prepareQueue}>Prepare resume queue</Button>
            <Button disabled={Boolean(busy) || !(state?.applications.some(a => a.status === 'ready')) || !health?.browser} onClick={runReviewed}>Start auto-apply for reviewed jobs</Button>
            <Button variant="outline" disabled={!state?.jobs.length} onClick={exportApplications}>Export tracker CSV</Button>
            <Button variant="ghost" disabled={Boolean(busy) || !health.browser} onClick={async () => { try { await jobRequest('/browser/close', { method: 'POST' }); toast.success('Application browser closed'); } catch (cause) { toast.error((cause as Error).message); } }}>Close application browser</Button>
            {(queueMessage || state?.lastRun) && <p className="w-full text-sm text-muted-foreground">{state?.lastRun ? `${state.lastRun.completed} completed. ${state.lastRun.message}` : queueMessage}</p>}
          </CardContent></Card>
        <Card><CardHeader><CardTitle>4. Application queue</CardTitle><CardDescription>{filteredJobs.length} jobs. Select one to tailor or submit.</CardDescription></CardHeader><CardContent className="space-y-3">
          <Input aria-label="Filter jobs" placeholder="Filter by company or title" value={searchText} onChange={e => setSearchText(e.target.value)} />
          {filteredJobs.map(job => { const a = state?.applications.find(item => item.jobId === job.id); return <button key={job.id} className={`w-full text-left rounded-lg border p-3 hover:border-primary ${selectedId === job.id ? 'border-primary bg-accent/30' : ''}`} onClick={() => selectJob(job)}>
            <strong className="block">{job.title}</strong><span className="text-sm text-muted-foreground">{job.company} · {job.source}</span>
            <div className="mt-2"><Badge variant="outline">{a ? statusNames[a.status] || a.status : 'Found'}</Badge></div></button>; })}
          {!filteredJobs.length && <p className="text-sm text-muted-foreground">No jobs yet. Search or import a URL.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>{selectedJob ? `${selectedJob.title} · ${selectedJob.company}` : 'Choose a job'}</CardTitle>
          {selectedJob && <CardDescription>{selectedJob.source} · {selectedJob.verifiedAt ? 'Page checked' : 'Description provided manually'} · <a className="underline" href={selectedJob.url} target="_blank" rel="noopener noreferrer">View listing <ExternalLink className="inline h-3 w-3" /></a></CardDescription>}</CardHeader>
          <CardContent className="space-y-4">
            {selectedJob && <><p className="text-sm max-h-40 overflow-auto whitespace-pre-wrap">{selectedJob.description}</p>
              {!selectedApplication && <Button disabled={Boolean(busy) || !state?.resume} onClick={() => run('tailor', () => jobPost(`/${selectedId}/tailor`, {}))}>Tailor resume for this job</Button>}
              {selectedApplication && <ApplicationDetail application={selectedApplication} latex={latex} setLatex={setLatex} manualReceipt={manualReceipt} setManualReceipt={setManualReceipt} busy={busy} run={run} />}
            </>}
          </CardContent></Card>
      </div>
    </main>
  </div>;
}

function ApplicationDetail({ application, latex, setLatex, manualReceipt, setManualReceipt, busy, run }: {
  application: Application; latex: string; setLatex: (s: string) => void; manualReceipt: string; setManualReceipt: (s: string) => void;
  busy: string; run: (key: string, action: () => Promise<JobState>) => Promise<void>;
}) {
  const id = application.jobId;
  return <div className="space-y-4 border-t pt-4">
    <div className="flex items-center gap-2"><Badge>{statusNames[application.status] || application.status}</Badge><span className="text-sm">{application.message}</span></div>
    {application.changes?.length ? <div><p className="font-medium text-sm">Tailoring changes</p><ul className="list-disc pl-5 text-sm">{application.changes.map((c,i) => <li key={i}>{c}</li>)}</ul></div> : null}
    {application.gaps?.length ? <div><p className="font-medium text-sm">Qualification gaps to check</p><ul className="list-disc pl-5 text-sm">{application.gaps.map((c,i) => <li key={i}>{c}</li>)}</ul></div> : null}
    {application.layoutNotes && <p className="text-sm text-muted-foreground">Layout: {application.layoutNotes}</p>}
    <div className="flex flex-wrap gap-2"><FileLink name={`${id}.tex`} label="Download LaTeX" /><FileLink name={`${id}.txt`} label="Cover letter" />
      {application.pdfHash && <FileLink name={`${id}.pdf`} label="Preview tailored PDF" preview />}</div>
    {!['submitted','submitted_manually','submission_unknown','submitting'].includes(application.status) && <div className="space-y-2"><Label htmlFor="latex">Edit reconstructed LaTeX</Label>
      <Textarea id="latex" className="font-mono min-h-48" value={latex} onChange={e => setLatex(e.target.value)} placeholder="Select this job again to load its LaTeX source." />
      <Button variant="outline" disabled={Boolean(busy) || !latex} onClick={() => run('compile', () => jobPost(`/${id}/compile`, { latex }))}>Compile edited LaTeX</Button></div>}
    {application.pdfHash && application.status === 'needs_review' && <div className="space-y-2"><p className="text-sm">Compare the preview with the original PDF. Check names, dates, metrics, layout, links and every claim.</p>
      <Button disabled={Boolean(busy)} onClick={() => run('review', () => jobPost(`/${id}/review`, { pdfHash: application.pdfHash }))}><ShieldCheck className="h-4 w-4 mr-2" />I reviewed this PDF</Button></div>}
    {['ready','needs_input'].includes(application.status) && <Button disabled={Boolean(busy)} onClick={() => run('apply', () => jobPost(`/${id}/apply`, {}))}>{application.status === 'needs_input' ? 'Resume in open browser' : 'Open browser, fill and submit'}</Button>}
    {application.status === 'submission_unknown' && <Button variant="outline" disabled={Boolean(busy)} onClick={() => run('check', () => jobPost(`/${id}/receipt`, {}))}>Check for receipt</Button>}
    {['ready','needs_input','submission_unknown'].includes(application.status) && <div className="space-y-2 border-t pt-3"><Label htmlFor="manualReceipt">If you submitted it yourself, enter the confirmation or reference</Label>
      <div className="flex gap-2"><Input id="manualReceipt" value={manualReceipt} onChange={e => setManualReceipt(e.target.value)} placeholder="Confirmation text or reference" />
        <Button variant="outline" disabled={!manualReceipt.trim() || Boolean(busy)} onClick={() => run('manual', () => jobPost(`/${id}/receipt`, { manualReceipt }))}>Record submission</Button></div></div>}
    {application.receipt && <div className="text-sm border rounded-md p-3"><strong>Receipt:</strong> {application.receipt.text}</div>}
    {busy && <p className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-1" />Working…</p>}
  </div>;
}
