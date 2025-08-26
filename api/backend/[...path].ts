// Vercel serverless proxy: forwards /api/backend/* requests to Elastic Beanstalk backend.
// Helps avoid mixed-content (HTTPS -> HTTP) and hides backend origin.
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Configure in Vercel project settings: EB_BACKEND_ORIGIN = http://wheresmystipend-env-1.eba-bdf4swct.ap-south-1.elasticbeanstalk.com
const ORIGIN = (process.env.EB_BACKEND_ORIGIN || process.env.BACKEND_ORIGIN || '').replace(/\/$/, '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!ORIGIN) {
    res.status(500).json({ error: 'EB_BACKEND_ORIGIN not set' });
    return;
  }

  const segments = (req.query.path as string[] | undefined) || [];
  const targetPath = segments.join('/');
  const url = `${ORIGIN}/${targetPath}`;

  try {
    // Collect body (works for JSON, multipart, etc.)
    let body: Buffer | undefined;
    if (req.method && !['GET','HEAD'].includes(req.method)) {
      body = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
    }

    // Copy headers except host & content-length (will be recalculated)
    const headers: Record<string,string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const lk = k.toLowerCase();
      if (['host','content-length'].includes(lk)) continue;
      if (Array.isArray(v)) headers[k] = v.join(','); else headers[k] = String(v);
    }

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: body as any,
    });

    const respBody = Buffer.from(await upstream.arrayBuffer());
    // Mirror status & basic headers
    upstream.headers.forEach((value, key) => {
      if (['content-length','transfer-encoding'].includes(key)) return;
      res.setHeader(key, value);
    });
    res.status(upstream.status).send(respBody);
  } catch (err: any) {
    res.status(502).json({ error: 'Proxy error', detail: err?.message || String(err) });
  }
}
