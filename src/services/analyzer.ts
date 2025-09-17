import { API_BASE } from "@/lib/apiBase";
import type { JobResult } from "./jobApi";

export interface AnalyzeJobInput {
  title: string;
  description: string;
  company?: string;
  tags?: string[];
  url?: string;
}

export interface GrammarFix {
  issue: string;
  suggestion: string;
}

export interface AnalyzerAIBlock {
  model: string;
  suggestions?: string[];
  weak_points?: string[];
  grammar_fixes?: GrammarFix[];
  raw?: string;
}

export interface AnalyzerResultItem {
  title: string;
  company?: string;
  url?: string;
  score: number; // 0..100
  matched_keywords: string[];
  missing_keywords: string[];
}

export interface AnalyzerResponse {
  results: AnalyzerResultItem[];
  suggestions: string[];
  ai?: AnalyzerAIBlock;
  ai_error?: string;
}

function getClientSessionId(): string | null {
  try {
    const key = "wm.session.v1";
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return null;
  }
}

export async function analyzeResumeAgainstJobs(args: {
  resume_text?: string;
  resume_skills?: string[];
  jobs: AnalyzeJobInput[];
  top_job_keywords?: number;
  top_missing?: number;
  use_ai?: boolean;
  ai_model?: string;
}): Promise<AnalyzerResponse> {
  const sid = getClientSessionId();
  const res = await fetch(`${API_BASE}/api/analyze/resume-vs-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(sid ? { "X-Session-Id": sid } : {}) },
    body: JSON.stringify({
      resume_text: args.resume_text,
      resume_skills: args.resume_skills,
      jobs: args.jobs,
      top_job_keywords: args.top_job_keywords ?? 20,
      top_missing: args.top_missing ?? 8,
      use_ai: args.use_ai ?? true,
      ai_model: args.ai_model,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function toAnalyzeJobInputs(jobs: JobResult[]): AnalyzeJobInput[] {
  return jobs.map((j) => ({
    title: j.title,
    description: j.description || "",
    company: j.company,
    tags: j.required_skills || [],
    url: j.url,
  }));
}
