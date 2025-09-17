import { API_BASE } from "@/lib/apiBase";

export type Testimonial = {
  id: string;
  name: string;
  role?: string | null;
  company?: string | null;
  message: string;
  image_url?: string | null;
  created_at: string;
};

export async function fetchTestimonials(): Promise<Testimonial[]> {
  const res = await fetch(`${API_BASE}/api/testimonials/`);
  if (!res.ok) throw new Error(`Failed to fetch testimonials: ${res.status}`);
  const data = (await res.json()) as Testimonial[];
  // Normalize image URLs to absolute when backend returns relative path
  return data.map((t) => ({
    ...t,
    image_url: t.image_url && /^https?:\/\//i.test(t.image_url)
      ? t.image_url
      : (t.image_url ? `${API_BASE}${t.image_url}` : t.image_url),
  }));
}

export async function submitTestimonial(input: {
  name: string;
  message: string;
  role?: string;
  company?: string;
  file?: File | null;
}): Promise<Testimonial> {
  const form = new FormData();
  form.set("name", input.name);
  form.set("message", input.message);
  if (input.role) form.set("role", input.role);
  if (input.company) form.set("company", input.company);
  if (input.file) form.set("proof", input.file);

  const res = await fetch(`${API_BASE}/api/testimonials/`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
