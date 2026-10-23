import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';
import { looksLikeJobDetail, searchJobs } from '../server/search.mjs';
import { canApply, Store } from '../server/store.mjs';
import { answerFor } from '../server/apply.mjs';
import { fillApplication, receiptOn, receiptOnPages } from '../server/apply.mjs';
import { validateLatex } from '../server/tailor.mjs';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const sampleLatex = '\\documentclass{article}\n\\begin{document}\nCandidate\\end{document}';
const job = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Software Engineer', company: 'Acme',
  description: 'Build React applications with TypeScript. Create accessible interfaces and maintain automated tests.',
  url: 'https://example.com/careers/software-engineer', source: 'Company careers', verifiedAt: new Date().toISOString() };

test('search reports source failures and keeps only real page URLs', async () => {
  const fakeFetch = async url => {
    const site = new URL(url).searchParams.get('q');
    if (site.includes('naukri.com')) return { ok: true, json: async () => ({ web: { results: [
      { url: 'https://naukri.com/job/123' }, { url: 'https://evil.example/job/456' },
    ] } }) };
    return { ok: false, status: 429 };
  };
  const result = await searchJobs({ role: 'Engineer', location: 'India', sources: ['naukri','linkedin'], careerDomains: [] }, 'test', fakeFetch, async url => ({ ...job, id: url === job.url ? job.id : 'bbbbbbbbbbbbbbbbbbbbbbbb', url, structuredPosting: true }));
  assert.equal(result.jobs.length, 1);
  assert.equal(result.coverage.length, 2);
  assert.match(result.coverage[1].error, /429/);
});

test('search recognizes individual job URLs but not board landing pages', () => {
  assert.equal(looksLikeJobDetail('https://linkedin.com/jobs/view/123'), true);
  assert.equal(looksLikeJobDetail('https://in.indeed.com/viewjob?jk=abc'), true);
  assert.equal(looksLikeJobDetail('https://company.com/jobs/software-engineer'), true);
  assert.equal(looksLikeJobDetail('https://linkedin.com/jobs/'), false);
  assert.equal(looksLikeJobDetail('https://linkedin.com/jobs/search'), false);
  assert.equal(looksLikeJobDetail('https://naukri.com/job-listings-frontend-intern-123'), true);
});

test('resume form answers require exact question labels; dangerous LaTeX is blocked', () => {
  assert.equal(answerFor('Work authorization', { answers: { 'Work authorization': 'Yes' } }), 'Yes');
  assert.equal(answerFor('Are you authorized to work?', { answers: { 'Work authorization': 'Yes' } }), undefined);
  assert.throws(() => validateLatex('\\documentclass{article}\\begin{document}\\input{/etc/passwd}\\end{document}'));
  assert.equal(canApply({ status: 'submission_unknown', pdfHash: 'abc', reviewedHash: 'abc' }), false);
});

test('API requires review and never retries an uncertain submission', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'careerforge-test-'));
  let attempts = 0;
  const runner = {
    async run(_user, _directory, _job, _application, _profile, persist) {
      attempts++;
      await persist({ status: 'submitting', submittedAttemptAt: new Date().toISOString() });
      return { status: 'submission_unknown', message: 'No receipt' };
    },
    async check() { return null; }, async close() {},
  };
  const app = createApp({ authMode: 'local', localToken: 'test-token', dataDir: directory,
    origins: ['http://localhost:8080'], braveKey: 'test', openaiKey: 'test', model: 'test',
    latexImage: 'test', enableBrowser: true,
  }, {
    runner, compiler: async () => true,
    search: async () => ({ jobs: [job], coverage: [{ source: 'Test', count: 1, rejected: 0, error: null }] }),
    tailor: async () => ({ latex: sampleLatex, coverLetter: 'Hello Acme', changes: ['Reordered bullets'], gaps: [], layoutNotes: 'Reconstructed' }),
    compile: async () => Buffer.from('%PDF-fake'),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/jobs`;
  const call = (url, body, bearer = 'test-token') => fetch(`${base}${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${bearer}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  try {
    assert.equal((await call('/state', undefined, 'wrong')).status, 401);
    const profile = { fullName: 'A B', firstName: 'A', lastName: 'B', email: 'a@example.com',
      phone: '', linkedin: '', portfolio: '', role: 'Engineer', location: 'India', facts: 'React', answers: {} };
    assert.equal((await call('/profile', profile)).status, 200);
    const form = new FormData(); form.append('resume', new Blob([Buffer.from('%PDF-test')], { type: 'application/pdf' }), 'resume.pdf');
    assert.equal((await call('/resume', form)).status, 200);
    assert.equal((await call('/search', { role: 'Engineer', location: 'India', sources: ['naukri'], careerDomains: [] })).status, 200);
    let response = await call(`/${job.id}/tailor`, {});
    assert.equal(response.status, 200);
    let state = await response.json();
    assert.equal(state.applications[0].status, 'needs_review');
    assert.equal((await call(`/${job.id}/apply`, {})).status, 409);
    assert.equal((await call(`/${job.id}/review`, { pdfHash: 'wrong' })).status, 409);
    state = await (await call(`/${job.id}/review`, { pdfHash: state.applications[0].pdfHash })).json();
    assert.equal(state.applications[0].status, 'ready');
    state = await (await call(`/${job.id}/apply`, {})).json();
    assert.equal(state.applications[0].status, 'submission_unknown');
    assert.equal((await call(`/${job.id}/apply`, {})).status, 409);
    assert.equal(attempts, 1);
    state = await (await call(`/${job.id}/receipt`, { manualReceipt: 'Confirmation 123' })).json();
    assert.equal(state.applications[0].status, 'submitted_manually');
    state.applications[0].status = 'submitting';
    await new Store(directory).write('local-user', state);
    state = await (await call('/state')).json();
    assert.equal(state.applications[0].status, 'submission_unknown');
    assert.equal((await new Store(directory).read('local-user')).applications[0].status, 'submission_unknown', 'restart recovery is durable');
  } finally {
    server.close(); await rm(directory, { recursive: true, force: true });
  }
});

test('browser fills known fields and pauses on unanswered requirements', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
  const dir = await mkdtemp(path.join(tmpdir(), 'careerforge-browser-test-'));
  const pdf = path.join(dir, 'resume.pdf');
  await writeFile(pdf, '%PDF-fake');
  try {
    const page = await browser.newPage();
    await page.setContent(`<form>
      <label>Full name <input name="full_name" required></label>
      <label>Email <input type="email" required></label>
      <label>Work authorization <select required><option value="">Choose</option><option>Yes</option><option>No</option></select></label>
      <label>Resume <input type="file" accept="application/pdf" required></label>
      <button type="submit">Submit application</button>
    </form>`);
    const first = await fillApplication(page.locator('form'), { fullName: 'Ada Smith', email: 'ada@example.com', answers: {} }, pdf);
    assert.deepEqual(first.unanswered, ['Work authorization']);
    assert.equal(first.attached, true);
    assert.equal(await page.locator('input[name="full_name"]').inputValue(), 'Ada Smith');
    const second = await fillApplication(page.locator('form'), { fullName: 'Ada Smith', email: 'ada@example.com', answers: { 'Work authorization': 'Yes' } }, pdf);
    assert.deepEqual(second.unanswered, []);
    assert.equal(await page.locator('select').inputValue(), 'Yes');
    assert.equal(await receiptOn(page), null);
    const confirmation = await browser.newPage();
    await confirmation.setContent('<h1>Your application has been submitted.</h1>');
    assert.match((await receiptOnPages(new Set([page, confirmation]))).text, /submitted/);
    assert.equal(await receiptOnPages(new Set([page])), null, 'unrelated tabs must not supply a receipt');
  } finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }
});

test('reviewed queue stops at the first form needing input', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'studentpilot-queue-test-'));
  const second = { ...job, id: 'cccccccccccccccccccccccc', url: 'https://example.com/careers/second', title: 'Second role' };
  let attempts = 0;
  const runner = {
    async run() { attempts++; return { status: 'needs_input', message: 'Sign in to the employer site.' }; },
    async close() {}, async check() { return null; },
  };
  const app = createApp({ authMode: 'local', localToken: 'test-token', dataDir: directory,
    origins: ['http://localhost:5173'], braveKey: 'test', openaiKey: 'test', model: 'test',
    latexImage: 'test', enableBrowser: true,
  }, {
    runner, compiler: async () => true,
    search: async () => ({ jobs: [job, second], coverage: [] }),
    tailor: async () => ({ latex: sampleLatex, coverLetter: 'Hello', changes: [], gaps: [], layoutNotes: 'Reconstructed' }),
    compile: async () => Buffer.from('%PDF-fake'),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/jobs`;
  const call = async (route, body) => {
    const response = await fetch(`${base}${route}`, { method: 'POST', headers: { Authorization: 'Bearer test-token', ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
    return response.json();
  };
  try {
    await call('/profile', { fullName: 'A B', firstName: 'A', lastName: 'B', email: 'a@example.com',
      phone: '', linkedin: '', portfolio: '', role: 'Engineer', location: 'India', facts: '', answers: {} });
    const form = new FormData(); form.append('resume', new Blob([Buffer.from('%PDF-test')]), 'resume.pdf');
    await call('/resume', form);
    const found = await call('/search', { role: 'Engineer', location: 'India', sources: ['naukri'], careerDomains: [] });
    assert.deepEqual(found.searchJobIds, [job.id, second.id]);
    let state = await call('/queue/prepare', { jobIds: [job.id, second.id] });
    assert.equal(state.applications.length, 2);
    assert.equal(state.lastRun.completed, 2);
    for (const application of state.applications) {
      state = await call(`/${application.jobId}/review`, { pdfHash: application.pdfHash });
    }
    state = await call('/run-reviewed', { jobIds: [job.id, second.id] });
    assert.equal(attempts, 1);
    assert.equal(state.lastRun.stoppedAt, job.id);
    assert.equal(state.applications.find(item => item.jobId === job.id).status, 'needs_input');
    assert.equal(state.applications.find(item => item.jobId === second.id).status, 'ready');
    state = await call('/profile', { fullName: 'A B', firstName: 'A', lastName: 'B', email: 'a@example.com',
      phone: '', linkedin: '', portfolio: '', role: 'Engineer', location: 'India', facts: 'Updated experience', answers: {} });
    assert.equal(state.applications.length, 0, 'old tailored applications must be removed when confirmed facts change');
    state = await call('/queue/prepare', { jobIds: [job.id] });
    assert.equal(state.applications[0].status, 'needs_review', 'the queue can regenerate after a profile change');
    const replacement = new FormData(); replacement.append('resume', new Blob([Buffer.from('%PDF-new')]), 'updated.pdf');
    state = await call('/resume', replacement);
    assert.equal(state.applications.length, 0, 'a new resume invalidates old tailored applications');
  } finally { server.close(); await rm(directory, { recursive: true, force: true }); }
});
