import { lookup } from 'node:dns/promises';
import https from 'node:https';
import ipaddr from 'ipaddr.js';

export function isPublicAddress(value) {
  try {
    const address = ipaddr.process(value);
    return address.range() === 'unicast';
  } catch { return false; }
}

export async function validatePublicUrl(value, resolver = lookup) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Use a public HTTPS job URL without credentials or a custom port.');
  }
  const addresses = await resolver(url.hostname.replace(/^\[|\]$/g, ''), { all: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
    throw new Error('Private and local network addresses are not allowed.');
  }
  return { url, addresses };
}

// Resolve once and pin the connection to a validated address, including on redirects.
export async function publicHtml(value, remaining = 4) {
  const { url, addresses } = await validatePublicUrl(value);
  const response = await new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'StudentPilot/1.0 (job application assistant)', Accept: 'text/html' },
      lookup: (_host, options, callback) => options.all
        ? callback(null, [addresses[0]])
        : callback(null, addresses[0].address, addresses[0].family),
    }, res => {
      const chunks = [];
      let bytes = 0;
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 2_000_000) req.destroy(new Error('Job page exceeds the 2 MB limit.'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    const timer = setTimeout(() => req.destroy(new Error('Job page timed out.')), 12_000);
    req.once('close', () => clearTimeout(timer));
    req.once('error', reject);
  });
  if (response.status >= 300 && response.status < 400 && response.headers.location) {
    if (!remaining) throw new Error('Too many job page redirects.');
    return publicHtml(new URL(response.headers.location, url).href, remaining - 1);
  }
  if (response.status !== 200) throw new Error(`Job page returned HTTP ${response.status}.`);
  if (!response.headers['content-type']?.includes('text/html')) throw new Error('The job URL must point to an HTML page.');
  return { html: response.body, url: url.href };
}
