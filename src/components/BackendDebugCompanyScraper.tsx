import React, { useState } from 'react';
import { scrapeCompany, scrapeBatch, type CompanyJob } from '../services/companyScraper';

export default function BackendDebugCompanyScraper() {
  const [input, setInput] = useState('https://boards.greenhouse.io/stripe');
  const [listInput, setListInput] = useState('https://boards.greenhouse.io/stripe\nhttps://jobs.lever.co/airbnb');
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [errors, setErrors] = useState<{ url: string; error: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const runSingle = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const out = await scrapeCompany(input.trim());
      setJobs(out);
    } catch (e: any) {
      setErrors([{ url: input, error: String(e?.message || e) }]);
    } finally {
      setLoading(false);
    }
  };

  const runBatch = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const urls = listInput.split(/\n|,|\s+/).map(s => s.trim()).filter(Boolean);
      const out = await scrapeBatch(urls, 10);
      setJobs(out.results);
      setErrors(out.errors);
    } catch (e: any) {
      setErrors([{ url: 'batch', error: String(e?.message || e) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-md space-y-3">
      <h3 className="font-semibold">Company Careers Scraper (Debug)</h3>
      <div className="space-y-2">
        <div>
          <label className="block text-sm">Single URL</label>
          <input value={input} onChange={e => setInput(e.target.value)} className="w-full border px-2 py-1 rounded" />
          <button onClick={runSingle} className="mt-2 px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading}>Scrape</button>
        </div>
        <div>
          <label className="block text-sm">Batch URLs (newline or comma separated)</label>
          <textarea value={listInput} onChange={e => setListInput(e.target.value)} className="w-full border px-2 py-1 rounded h-24" />
          <button onClick={runBatch} className="mt-2 px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50" disabled={loading}>Batch Scrape</button>
        </div>
      </div>
      {loading && <div className="text-sm">Loading…</div>}
      {!!errors.length && (
        <div className="text-sm text-red-600">
          <div className="font-medium">Errors</div>
          <ul className="list-disc pl-5">
            {errors.map((e, i) => <li key={i}>{e.url}: {e.error}</li>)}
          </ul>
        </div>
      )}
      <div>
        <div className="text-sm mb-1">Results: {jobs.length}</div>
        <ul className="space-y-2 max-h-80 overflow-auto">
          {jobs.map((j, idx) => (
            <li key={idx} className="border rounded p-2">
              <div className="font-medium">{j.title}</div>
              <div className="text-xs text-gray-600">
                {j.company ? `${j.company} • ` : ''}{j.location} {j.source ? `• ${j.source}` : ''}
              </div>
              <div className="text-xs line-clamp-3">{j.description}</div>
              <a className="text-blue-600 text-sm" href={j.apply_url} target="_blank" rel="noreferrer">Apply</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
