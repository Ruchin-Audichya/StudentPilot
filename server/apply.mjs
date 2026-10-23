import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { validatePublicUrl } from './network.mjs';

export const normalizeLabel = value => value.toLowerCase().replace(/[*:]/g, '').replace(/\s+/g, ' ').trim();

export function answerFor(label, profile) {
  const key = normalizeLabel(label);
  const answers = Object.fromEntries(Object.entries(profile.answers || {}).map(([k, v]) => [normalizeLabel(k), v]));
  if (Object.hasOwn(answers, key)) return answers[key];
  const fields = {
    'full name': profile.fullName, name: profile.fullName,
    'first name': profile.firstName, 'last name': profile.lastName,
    email: profile.email, 'email address': profile.email,
    phone: profile.phone, 'phone number': profile.phone,
    'linkedin profile': profile.linkedin, 'linkedin url': profile.linkedin,
    'portfolio url': profile.portfolio, 'website': profile.portfolio,
  };
  return fields[key];
}

export async function fillApplication(scope, profile, pdfPath) {
  const fields = scope.locator('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select');
  const unanswered = [];
  let attached = false;
  let filled = 0;
  for (let i = 0; i < await fields.count(); i++) {
    const field = fields.nth(i);
    const meta = await field.evaluate(el => ({
      label: Array.from(el.labels || []).map(l => {
        const clone = l.cloneNode(true);
        clone.querySelectorAll('input, select, textarea, option, button').forEach(node => node.remove());
        return clone.textContent;
      }).join(' ').trim() || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || '',
      type: el.getAttribute('type') || el.tagName.toLowerCase(),
      required: el.required || el.getAttribute('aria-required') === 'true',
      value: el.value, checked: el.checked, disabled: el.disabled,
    }));
    if (meta.disabled || (meta.type !== 'file' && !await field.isVisible())) continue;
    const label = normalizeLabel(meta.label);
    if (meta.type === 'password' || /captcha|one.time|verification code|\botp\b/i.test(label)) {
      unanswered.push('Complete login or verification in the browser'); continue;
    }
    if (meta.type === 'file') {
      if (/resume|\bcv\b|curriculum/i.test(label) && !/cover letter/i.test(label)) {
        await field.setInputFiles(pdfPath); attached = true;
      } else if (meta.required) unanswered.push(meta.label || 'Required file upload');
      continue;
    }
    const answer = answerFor(meta.label, profile);
    if (['checkbox', 'radio'].includes(meta.type)) {
      // Never infer legal consent, work authorization or demographic answers.
      if (answer === true || answer === 'true') await field.check();
      else if (meta.type === 'checkbox' && (answer === false || answer === 'false')) await field.uncheck();
      else if (!meta.checked) unanswered.push(meta.label || 'Selection');
      continue;
    }
    if (answer !== undefined && answer !== '') {
      if (meta.type === 'select') {
        try { await field.selectOption({ label: String(answer) }); }
        catch { unanswered.push(meta.label); }
      } else {
        await field.fill(String(answer)); filled++;
      }
    } else if (!meta.value && meta.required) unanswered.push(meta.label || 'Required field');
  }
  return { unanswered: [...new Set(unanswered)], attached, filled };
}

const confirmationPattern = /^(your application (has been|was) (successfully )?(submitted|received)|application (successfully )?(submitted|received)|thank you for applying)[.!\s]/i;
export async function receiptOn(page) {
  for (const frame of page.frames()) {
    const candidates = frame.locator('h1, h2, h3, [role="status"], [role="alert"], .application-confirmation, .post-application-message');
    for (let i = 0; i < await candidates.count(); i++) {
      const item = candidates.nth(i);
      if (!await item.isVisible()) continue;
      const text = (await item.innerText()).trim();
      if (confirmationPattern.test(`${text} `)) return { text: text.slice(0, 1000), url: page.url(), observedAt: new Date().toISOString() };
    }
  }
  return null;
}

// Local, visible browsers allow users to handle portal-specific login and questions.
// Universal coverage is deliberately not claimed: complex/multistep forms hand off.
export class ApplicationRunner {
  sessions = new Map();
  async connect(user, directory, url) {
    await validatePublicUrl(url);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    let session = this.sessions.get(user);
    if (!session) {
      const context = await chromium.launchPersistentContext(path.join(directory, 'browser-profile'), {
        headless: false, acceptDownloads: false, serviceWorkers: 'block',
        executablePath: process.env.APPLICATION_BROWSER_EXECUTABLE || undefined,
      });
      await context.route('**/*', async route => {
        try { await validatePublicUrl(route.request().url()); await route.continue(); }
        catch { await route.abort(); }
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      session = { context, page: context.pages()[0] || await context.newPage(), jobId: null };
      this.sessions.set(user, session);
      context.on('close', () => this.sessions.delete(user));
    }
    if (session.jobId) throw new Error('Finish or close the current application browser before opening another account.');
    const page = await session.context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    return { openedAt: new Date().toISOString() };
  }
  async run(user, directory, job, application, profile, persist) {
    let session = this.sessions.get(user);
    if (session && session.jobId && session.jobId !== job.id) throw new Error('Close the current application browser before starting another job.');
    if (!session) {
      await validatePublicUrl(job.url);
      const context = await chromium.launchPersistentContext(path.join(directory, 'browser-profile'), {
        headless: false, acceptDownloads: false, serviceWorkers: 'block',
        executablePath: process.env.APPLICATION_BROWSER_EXECUTABLE || undefined,
      });
      await context.route('**/*', async route => {
        try { await validatePublicUrl(route.request().url()); await route.continue(); }
        catch { await route.abort(); }
      });
      await context.routeWebSocket('**/*', ws => ws.close());
      const page = context.pages()[0] || await context.newPage();
      session = { context, page, jobId: job.id };
      this.sessions.set(user, session);
      context.on('close', () => this.sessions.delete(user));
      try { await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30_000 }); }
      catch { /* A partially loaded page can still be completed by the user. */ }
    } else if (!session.jobId) {
      session.jobId = job.id;
      session.page = await session.context.newPage();
      await session.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    }
    const page = session.context.pages().at(-1) || session.page;
    // A receipt from a previous session cannot verify a new submission.
    const existingReceipt = await receiptOn(page);
    if (existingReceipt) return { status: 'needs_input', message: 'This browser already shows a receipt. Verify the job and record it manually.' };
    const body = await page.locator('body').innerText().catch(() => '');
    if (/verify (you are|you're) human|complete the captcha|security verification/i.test(body)) {
      return { status: 'needs_input', message: 'Complete the CAPTCHA in the application browser, then resume.' };
    }
    let scope;
    for (const frame of page.frames()) {
      // Only automate a form that explicitly accepts a resume; do not fill newsletters.
      for (const form of await frame.locator('form').all()) {
        if (await form.locator('input[type=file]').count()) { scope = form; break; }
      }
      if (scope) break;
    }
    if (!scope) return { status: 'needs_input', message: 'Open the application form or sign in in the browser, then resume. Multi-step portals may need manual completion.' };
    const fields = await fillApplication(scope, profile, path.join(directory, `${job.id}.pdf`));
    if (fields.unanswered.length || !fields.attached) return {
      status: 'needs_input', message: fields.unanswered.length
        ? `Answer these fields in the browser, then resume: ${fields.unanswered.join('; ')}`
        : 'Could not identify a resume upload field. Complete this form manually.',
    };
    const invalid = await scope.locator(':invalid').count();
    if (invalid) return { status: 'needs_input', message: 'The form still has validation errors. Resolve them in the browser.' };
    const submit = scope.getByRole('button', { name: /^(submit application|send application|apply now|apply|submit)$/i });
    if (await submit.count() !== 1 || !await submit.isEnabled()) return { status: 'needs_input', message: 'The final submit button is ambiguous or disabled. Complete the application in the browser.' };
    // Write ahead: never retry an ambiguous submission after an interruption.
    await persist({ status: 'submitting', submittedAttemptAt: new Date().toISOString(), message: 'Submitting the reviewed application.' });
    try {
      await submit.click({ timeout: 15_000 });
      for (let attempt = 0; attempt < 15; attempt++) {
        const receipt = await receiptOn(page);
        if (receipt) return { status: 'submitted', receipt, message: 'The application page confirmed receipt.' };
        await page.waitForTimeout(1000);
      }
    } catch { /* The click could have succeeded; do not retry it. */ }
    return { status: 'submission_unknown', message: 'Submit was attempted but no receipt was detected. Check the browser or your email before taking further action. Automatic retry is disabled.' };
  }
  async check(user) {
    const session = this.sessions.get(user);
    return session ? receiptOn(session.context.pages().at(-1) || session.page) : null;
  }
  async close(user) { await this.sessions.get(user)?.context.close(); this.sessions.delete(user); }
}
