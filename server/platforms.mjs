export const platforms = [
  ['naukri', 'Naukri', 'naukri.com'],
  ['linkedin', 'LinkedIn', 'linkedin.com/jobs'],
  ['instahyre', 'Instahyre', 'instahyre.com'],
  ['cutshort', 'Cutshort', 'cutshort.io'],
  ['hirist', 'Hirist', 'hirist.tech'],
  ['indeed', 'Indeed India', 'in.indeed.com'],
  ['foundit', 'Foundit', 'foundit.in'],
  ['shine', 'Shine', 'shine.com'],
  ['timesjobs', 'TimesJobs', 'timesjobs.com'],
  ['glassdoor', 'Glassdoor', 'glassdoor.co.in'],
  ['wellfound', 'Wellfound / AngelList', 'wellfound.com'],
  ['weworkremotely', 'We Work Remotely', 'weworkremotely.com'],
].map(([id, name, domain]) => ({ id, name, domain, applicationSupport: 'assisted' }));

export function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|ref$|refId$|trackingId$|source$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href;
}

export function searchQueries({ role, location, sources, careerDomains }) {
  const terms = `${role.replace(/["\r\n]/g, ' ')} ${location.replace(/["\r\n]/g, ' ')}`;
  return [
    ...platforms.filter(p => sources.includes(p.id)).map(p => ({ ...p, query: `site:${p.domain} ${terms}` })),
    ...careerDomains.map(domain => ({ id: 'careers', name: domain, domain, query: `site:${domain} careers jobs ${terms}` })),
  ];
}
