import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { canonicalUrl, searchQueries } from './platforms.mjs';
import { publicHtml } from './network.mjs';

export const jobId = url => createHash('sha256').update(canonicalUrl(url)).digest('hex').slice(0, 24);
const plain = text => load(String(text || '')).text().replace(/\s+/g, ' ').trim();

export function looksLikeJobDetail(value) {
  const url = new URL(value);
  const path = url.pathname.toLowerCase();
  if (/\/(?:search|results|browse|all|internships|categories|locations)\/?$/.test(path)) return false;
  return /\/(?:jobs?|job-listings?|job-detail|positions?|vacancies|careers?|remote-jobs)\/(?:view\/|listing\/)?[^/]+(?:\/.*)?$/i.test(path)
    || /^\/job-listings-[^/]+$/.test(path)
    || (path === '/viewjob' && url.searchParams.has('jk'));
}

export function parseJob(html, url) {
  const $ = load(html);
  let posting;
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if ([value['@type']].flat().includes('JobPosting')) posting ||= value;
    for (const child of Object.values(value)) if (typeof child === 'object') {
      for (const item of [child].flat()) visit(item);
    }
  };
  $('script[type="application/ld+json"]').each((_i, el) => {
    try { visit(JSON.parse($(el).text())); } catch { /* Other scripts may not be JSON. */ }
  });
  $('script, style, nav, header, footer').remove();
  const description = posting ? plain(posting.description) : $('main').text().trim() || $('body').text().trim();
  return {
    id: jobId(url), url: canonicalUrl(url), title: plain(posting?.title || $('h1').first().text() || $('title').text()).slice(0, 250),
    company: plain(posting?.hiringOrganization?.name || new URL(url).hostname),
    description: description.replace(/\s+/g, ' ').slice(0, 24_000),
    postedAt: posting?.datePosted || null,
    expiresAt: posting?.validThrough || null,
    verifiedAt: new Date().toISOString(),
    structuredPosting: Boolean(posting),
  };
}

export async function inspectJob(url) {
  const page = await publicHtml(url);
  const job = parseJob(page.html, page.url);
  if (job.expiresAt && Date.parse(job.expiresAt) < Date.now()) throw new Error('This job listing has expired.');
  if (/\b(this (job|position) (is no longer|has been filled)|job (not found|has expired))\b/i.test(job.description)) {
    throw new Error('This job listing is no longer available.');
  }
  if (job.description.length < 100) throw new Error('Could not read a job description. Paste it manually after opening the listing.');
  return job;
}

export async function searchJobs(input, key, fetcher = fetch, inspect = inspectJob) {
  if (!key) throw new Error('Configure BRAVE_SEARCH_API_KEY on the server to search job boards. You can still import a job URL.');
  const jobs = new Map();
  const coverage = [];
  for (const source of searchQueries(input)) {
    let rejected = 0;
    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.search = new URLSearchParams({ q: source.query, count: '5', country: 'IN' }).toString();
      const response = await fetcher(url, { headers: { 'X-Subscription-Token': key, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`Search provider returned HTTP ${response.status}`);
      const results = (await response.json()).web?.results || [];
      const matched = await Promise.all(results.map(async result => {
        try {
          const host = new URL(result.url).hostname;
          const domain = source.domain.split('/')[0];
          if (host !== domain && !host.endsWith(`.${domain}`)) return null;
          const job = await inspect(result.url);
          // Search landing pages must not masquerade as individual vacancies.
          if (!job.structuredPosting && !looksLikeJobDetail(job.url)) return null;
          if (/\bintern(?:ship)?\b/i.test(input.role) && !/\bintern(?:ship)?\b|\btrainee\b|\bco-op\b|\bapprentice\b/i.test(`${job.title} ${job.description.slice(0, 1000)}`)) return null;
          return { ...job, source: source.name };
        } catch { rejected++; return null; }
      }));
      for (const job of matched.filter(Boolean)) jobs.set(job.id, job);
      coverage.push({ source: source.name, count: matched.filter(Boolean).length, rejected, error: null });
    } catch (error) { coverage.push({ source: source.name, count: 0, rejected, error: error.message }); }
    // Accommodate low-rate API plans; never retry submissions or hide search failures.
    if (fetcher === fetch) await new Promise(resolve => setTimeout(resolve, 1100));
  }
  return { jobs: [...jobs.values()], coverage };
}
