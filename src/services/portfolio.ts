import { API_BASE } from "@/lib/apiBase";

export interface PortfolioResume {
  name?: string;
  summary?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: { label?: string; url: string }[];
  skills?: string[];
  projects?: { title?: string; description?: string; link?: string; tech?: string[] }[];
  experience?: { company?: string; role?: string; period?: string; description?: string }[];
  education?: { school?: string; degree?: string; period?: string }[];
}

export async function generatePortfolioZip(
  resume?: PortfolioResume,
  include_vercel: boolean = true,
  options?: { ai?: boolean; model?: string }
): Promise<Blob> {
  const body: any = { include_vercel };
  if (resume) body.resume = resume;
  if (options && typeof options.ai !== "undefined") body.ai = options.ai;
  if (options && options.model) body.model = options.model;
  const res = await fetch(`${API_BASE}/api/portfolio/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
