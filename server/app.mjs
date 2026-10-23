import express from 'express';
import multer from 'multer';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { platforms } from './platforms.mjs';
import { inspectJob, jobId, searchJobs } from './search.mjs';
import { validatePublicUrl } from './network.mjs';
import { Store, digest, canApply, canTailor } from './store.mjs';
import { tailorResume } from './tailor.mjs';
import { compileLatex, compilerAvailable } from './compile.mjs';
import { ApplicationRunner } from './apply.mjs';

const text = (max = 200) => z.string().trim().max(max);
const profileSchema = z.object({
  fullName: text(), firstName: text(), lastName: text(), email: z.string().email(),
  phone: text(40), linkedin: text(500), portfolio: text(500),
  role: text(), location: text(), facts: text(12_000),
  answers: z.record(z.union([z.string().max(2000), z.boolean()])).refine(a => Object.keys(a).length <= 100),
});
const searchSchema = z.object({
  role: text().min(2), location: text(),
  sources: z.array(z.enum(platforms.map(p => p.id))).max(12),
  careerDomains: z.array(z.string().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i)).max(10),
});
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);
const errorWithStatus = (message, status = 400) => Object.assign(new Error(message), { status });

export function createApp(config, overrides = {}) {
  const app = express();
  const store = overrides.store || new Store(config.dataDir);
  const runner = overrides.runner || new ApplicationRunner();
  const search = overrides.search || searchJobs;
  const inspect = overrides.inspect || inspectJob;
  const tailor = overrides.tailor || tailorResume;
  const compile = overrides.compile || compileLatex;
  const compiler = overrides.compiler || compilerAvailable;
  const firebaseKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
  const busy = new Set();
  const rate = new Map();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    const origin = req.get('origin');
    if (origin && !config.origins.includes(origin)) return res.status(403).json({ error: 'Origin not allowed.' });
    if (origin) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); }
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '200kb' }));
  app.get('/api/jobs/health', async (_req, res) => res.json({
    authMode: config.authMode, search: Boolean(config.braveKey), tailoring: Boolean(config.openaiKey && config.model),
    compiler: await compiler(config.latexImage), browser: Boolean(config.enableBrowser), platforms,
  }));
  app.use('/api/jobs', async (req, _res, next) => {
    try {
      const token = req.get('authorization')?.replace(/^Bearer /, '') || '';
      if (config.authMode === 'local') {
        const expected = Buffer.from(config.localToken || '');
        const actual = Buffer.from(token);
        if (!expected.length || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw errorWithStatus('Enter the local access token printed by the job service.', 401);
        req.userId = 'local-user';
      } else {
        if (!config.firebaseProjectId) throw errorWithStatus('Configure FIREBASE_PROJECT_ID on the job service.', 503);
        try {
          const { payload } = await jwtVerify(token, firebaseKeys, {
            issuer: `https://securetoken.google.com/${config.firebaseProjectId}`,
            audience: config.firebaseProjectId, algorithms: ['RS256'],
          });
          if (!payload.sub) throw new Error('Missing Firebase user ID');
          req.userId = payload.sub;
        } catch { throw errorWithStatus('Sign in to StudentPilot to access your applications.', 401); }
      }
      const bucket = rate.get(req.userId) || { count: 0, until: Date.now() + 60_000 };
      if (Date.now() > bucket.until) { bucket.count = 0; bucket.until = Date.now() + 60_000; }
      bucket.count++; rate.set(req.userId, bucket);
      if (bucket.count > 100) throw errorWithStatus('Too many requests. Try again in a minute.', 429);
      next();
    } catch (error) { next(error); }
  });
  const mutation = handler => async (req, res) => {
    if (busy.has(req.userId)) throw errorWithStatus('Another job operation is running. Wait for it to finish.', 409);
    busy.add(req.userId);
    try { await handler(req, res); } finally { busy.delete(req.userId); }
  };
  const applicationFor = (state, id) => {
    idSchema.parse(id);
    const application = state.applications.find(a => a.jobId === id);
    if (!application) throw errorWithStatus('Generate a tailored resume for this job first.', 404);
    return application;
  };
  const assertFresh = (state, application) => {
    if (application.resumeHash !== state.resume?.hash || application.profileHash !== digest(JSON.stringify(state.profile))) {
      throw errorWithStatus('Your resume or profile has changed. Generate new materials before applying.', 409);
    }
  };
  app.get('/api/jobs/state', async (req, res) => {
    const state = await store.read(req.userId);
    // A process restart during submission has an unknown outcome, never a retryable one.
    for (const a of state.applications) if (a.status === 'submitting' && !busy.has(req.userId)) {
      a.status = 'submission_unknown'; a.message = 'The service restarted during submission. Check the employer receipt; automatic retry is disabled.';
    }
    res.json(state);
  });
  app.post('/api/jobs/profile', mutation(async (req, res) => {
    const profile = profileSchema.parse(req.body);
    const state = await store.read(req.userId);
    state.profile = profile;
    for (const a of state.applications) if (canTailor(a)) { a.reviewedHash = null; a.status = 'needs_review'; }
    await store.write(req.userId, state); res.json(state);
  }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5_000_000, files: 1, fields: 0 } }).single('resume');
  app.post('/api/jobs/resume', upload, mutation(async (req, res) => {
    if (!req.file || !req.file.originalname.toLowerCase().endsWith('.pdf') || req.file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw errorWithStatus('Upload a PDF resume, up to 5 MB.');
    }
    const state = await store.read(req.userId);
    await store.file(req.userId, 'original.pdf', req.file.buffer);
    state.resume = { name: req.file.originalname.slice(0, 200), hash: digest(req.file.buffer), uploadedAt: new Date().toISOString() };
    for (const a of state.applications) if (canTailor(a)) { a.reviewedHash = null; a.status = 'needs_review'; }
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/search', mutation(async (req, res) => {
    const input = searchSchema.parse(req.body);
    if (!input.sources.length && !input.careerDomains.length) throw errorWithStatus('Select a board or add a company career domain.');
    const result = await search(input, config.braveKey);
    const state = await store.read(req.userId);
    const jobs = new Map(state.jobs.map(job => [job.id, job]));
    for (const job of result.jobs) jobs.set(job.id, job);
    state.jobs = [...jobs.values()]; state.coverage = result.coverage;
    await store.write(req.userId, state); res.json({ ...state, searchJobIds: result.jobs.map(job => job.id) });
  }));
  app.post('/api/jobs/connections/:source', mutation(async (req, res) => {
    if (!config.enableBrowser) throw errorWithStatus('Start the local job service with ENABLE_APPLICATION_BROWSER=true.', 503);
    const source = platforms.find(item => item.id === req.params.source);
    if (!source) throw errorWithStatus('Unknown job platform.', 404);
    const state = await store.read(req.userId);
    const result = await runner.connect(req.userId, store.directory(req.userId), `https://${source.domain}/`);
    state.connections ||= {};
    state.connections[source.id] = result;
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/import', mutation(async (req, res) => {
    const input = z.object({ url: z.string().url().max(2000), title: text(250).optional(), company: text().optional(), description: text(24_000).optional() }).parse(req.body);
    await validatePublicUrl(input.url);
    let job;
    if (input.description) {
      if (!input.title || !input.company || input.description.length < 100) throw errorWithStatus('Enter the title, company and complete job description (at least 100 characters).');
      job = { id: jobId(input.url), ...input, postedAt: null, verifiedAt: null, source: 'Imported by you' };
    } else job = { ...await inspect(input.url), source: 'Company / imported URL' };
    const state = await store.read(req.userId);
    state.jobs = [...state.jobs.filter(j => j.id !== job.id), job];
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/:id/tailor', mutation(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const state = await store.read(req.userId);
    const job = state.jobs.find(j => j.id === id);
    if (!job || !state.resume) throw errorWithStatus('Upload a resume and select a job first.');
    profileSchema.parse(state.profile);
    const previous = state.applications.find(a => a.jobId === id);
    if (!canTailor(previous)) throw errorWithStatus('This job already has a submission attempt. Its materials are locked.', 409);
    const pdf = await readFile(path.join(store.directory(req.userId), 'original.pdf'));
    const result = await tailor({ pdf, job, profile: state.profile, apiKey: config.openaiKey, model: config.model });
    await store.file(req.userId, `${id}.tex`, result.latex);
    await store.file(req.userId, `${id}.txt`, result.coverLetter);
    const application = {
      jobId: id, job, status: 'needs_compile', changes: result.changes, gaps: result.gaps, layoutNotes: result.layoutNotes,
      resumeHash: state.resume.hash, profileHash: digest(JSON.stringify(state.profile)), reviewedHash: null, pdfHash: null,
      generatedAt: new Date().toISOString(), message: 'LaTeX generated. Compile it before reviewing.',
    };
    state.applications = [...state.applications.filter(a => a.jobId !== id), application];
    await store.write(req.userId, state);
    try {
      const output = await compile(result.latex, config.latexImage);
      await store.file(req.userId, `${id}.pdf`, output);
      Object.assign(application, { status: 'needs_review', pdfHash: digest(output), message: 'Compare the reconstructed layout and check the facts before approving.' });
    } catch (error) { application.message = error.message; }
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/:id/compile', mutation(async (req, res) => {
    const state = await store.read(req.userId);
    const application = applicationFor(state, req.params.id);
    if (!canTailor(application)) throw errorWithStatus('Submitted materials are locked.', 409);
    const latex = z.string().min(100).max(100_000).parse(req.body.latex);
    // Invalidate approval even if recompilation fails; an old PDF cannot be submitted.
    Object.assign(application, { status: 'needs_compile', reviewedHash: null, pdfHash: null });
    await store.file(req.userId, `${application.jobId}.tex`, latex);
    await store.write(req.userId, state);
    try {
      const output = await compile(latex, config.latexImage);
      await store.file(req.userId, `${application.jobId}.pdf`, output);
      Object.assign(application, { status: 'needs_review', pdfHash: digest(output), message: 'PDF compiled. Review the layout and facts.' });
    } catch (error) { application.message = error.message; }
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/:id/review', mutation(async (req, res) => {
    const state = await store.read(req.userId);
    const application = applicationFor(state, req.params.id);
    assertFresh(state, application);
    if (!canTailor(application) || !application.pdfHash || req.body.pdfHash !== application.pdfHash) throw errorWithStatus('Review the current compiled PDF first.', 409);
    Object.assign(application, { status: 'ready', reviewedHash: application.pdfHash, reviewedAt: new Date().toISOString(), message: 'Resume approved. Ready to apply.' });
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/:id/apply', mutation(async (req, res) => {
    if (!config.enableBrowser) throw errorWithStatus('Run the local service with ENABLE_APPLICATION_BROWSER=true to use the visible application browser.', 503);
    const state = await store.read(req.userId);
    const application = applicationFor(state, req.params.id);
    assertFresh(state, application);
    if (!canApply(application)) throw errorWithStatus('Review the resume first. A job with an uncertain or completed submission cannot be retried.', 409);
    const pdf = await readFile(path.join(store.directory(req.userId), `${application.jobId}.pdf`));
    if (digest(pdf) !== application.pdfHash) throw errorWithStatus('The PDF changed after review. Generate it again.', 409);
    if (application.job.expiresAt && Date.parse(application.job.expiresAt) < Date.now()) throw errorWithStatus('This job has expired.');
    const persist = async update => { Object.assign(application, update); await store.write(req.userId, state); };
    try { await persist(await runner.run(req.userId, store.directory(req.userId), application.job, application, state.profile, persist)); }
    catch (error) { await persist({ status: application.status === 'submitting' ? 'submission_unknown' : 'needs_input', message: error.message }); }
    res.json(state);
  }));
  app.post('/api/jobs/queue/prepare', mutation(async (req, res) => {
    const ids = z.array(idSchema).min(1).max(10).parse(req.body.jobIds);
    const state = await store.read(req.userId);
    if (!state.resume) throw errorWithStatus('Upload your PDF resume first.');
    profileSchema.parse(state.profile);
    const pdf = await readFile(path.join(store.directory(req.userId), 'original.pdf'));
    let completed = 0; let stoppedAt; let message = 'Prepared the selected resumes for review.';
    for (const id of ids) {
      const job = state.jobs.find(item => item.id === id);
      if (!job) { stoppedAt = id; message = 'A selected job is no longer in your queue.'; break; }
      const previous = state.applications.find(item => item.jobId === id);
      if (previous) continue;
      try {
        const result = await tailor({ pdf, job, profile: state.profile, apiKey: config.openaiKey, model: config.model });
        await store.file(req.userId, `${id}.tex`, result.latex);
        await store.file(req.userId, `${id}.txt`, result.coverLetter);
        const application = {
          jobId: id, job, status: 'needs_compile', changes: result.changes, gaps: result.gaps, layoutNotes: result.layoutNotes,
          resumeHash: state.resume.hash, profileHash: digest(JSON.stringify(state.profile)), reviewedHash: null, pdfHash: null,
          generatedAt: new Date().toISOString(), message: 'LaTeX generated. Compile it before reviewing.',
        };
        state.applications = [...state.applications.filter(item => item.jobId !== id), application];
        await store.write(req.userId, state);
        try {
          const output = await compile(result.latex, config.latexImage);
          await store.file(req.userId, `${id}.pdf`, output);
          Object.assign(application, { status: 'needs_review', pdfHash: digest(output), message: 'Compare the reconstructed layout and facts before approving.' });
        } catch (error) { application.message = error.message; }
        await store.write(req.userId, state); completed++;
      } catch (error) { stoppedAt = id; message = error.message; break; }
    }
    state.lastRun = { completed, stoppedAt, message };
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/run-reviewed', mutation(async (req, res) => {
    if (!config.enableBrowser) throw errorWithStatus('Start the local job service with ENABLE_APPLICATION_BROWSER=true.', 503);
    const ids = z.array(idSchema).min(1).max(10).parse(req.body.jobIds);
    const state = await store.read(req.userId);
    let completed = 0; let stoppedAt; let message = 'Finished the reviewed application queue.';
    for (const id of ids) {
      const application = state.applications.find(item => item.jobId === id);
      if (!application || application.status !== 'ready' || !canApply(application)) continue;
      try {
        assertFresh(state, application);
        const pdf = await readFile(path.join(store.directory(req.userId), `${id}.pdf`));
        if (digest(pdf) !== application.pdfHash) throw new Error('A reviewed PDF changed. Prepare it again.');
        if (application.job.expiresAt && Date.parse(application.job.expiresAt) < Date.now()) throw new Error('The job expired.');
        const persist = async update => { Object.assign(application, update); await store.write(req.userId, state); };
        const outcome = await runner.run(req.userId, store.directory(req.userId), application.job, application, state.profile, persist);
        await persist(outcome);
        if (outcome.status !== 'submitted') { stoppedAt = id; message = outcome.message; break; }
        completed++;
        await runner.close(req.userId).catch(() => {});
      } catch (error) {
        if (application.status !== 'submitted') Object.assign(application, { status: application.status === 'submitting' ? 'submission_unknown' : 'needs_input', message: error.message });
        await store.write(req.userId, state);
        stoppedAt = id; message = error.message; break;
      }
    }
    state.lastRun = { completed, stoppedAt, message };
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/:id/receipt', mutation(async (req, res) => {
    const state = await store.read(req.userId);
    const application = applicationFor(state, req.params.id);
    if (['submitted', 'submitted_manually'].includes(application.status)) return res.json(state);
    const manual = text(2000).parse(req.body.manualReceipt || '');
    if (manual) {
      Object.assign(application, { status: 'submitted_manually', receipt: { text: manual, observedAt: new Date().toISOString() }, message: 'Marked submitted by you.' });
    } else {
      if (!application.submittedAttemptAt) throw errorWithStatus('For a manual submission, enter the confirmation or receipt reference.');
      const receipt = await runner.check(req.userId);
      if (!receipt) throw errorWithStatus('No confirmation was found. Check the browser or employer email.');
      Object.assign(application, { status: 'submitted', receipt, message: 'The application page confirmed receipt.' });
    }
    await store.write(req.userId, state); res.json(state);
  }));
  app.post('/api/jobs/browser/close', mutation(async (req, res) => { await runner.close(req.userId); res.json({ ok: true }); }));
  app.get('/api/jobs/files/:name', async (req, res) => {
    const name = z.string().regex(/^(original\.pdf|[a-f0-9]{24}\.(pdf|tex|txt))$/).parse(req.params.name);
    const bytes = await readFile(path.join(store.directory(req.userId), name));
    res.type(name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
    res.set('Content-Disposition', `inline; filename="${name}"`); res.send(bytes);
  });
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'The PDF must be 5 MB or smaller.' });
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'The requested file does not exist.' });
    res.status(error.status || 400).json({ error: error.message || 'The operation failed. No success was recorded.' });
  });
  return app;
}
