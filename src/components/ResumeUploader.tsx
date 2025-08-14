
import { useState } from "react";
import { FIREBASE_READY, uploadToStorage } from "@/lib/firebase";

type Props = {
  onUploaded: (result: { status?: string; chars?: number; preview?: string; url?: string }) => void;
};

export default function ResumeUploader({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    let url: string | null = null;
    try {
      if (FIREBASE_READY) {
        url = await uploadToStorage(file);
      }
    } catch (e) {
      // Ignore, still send to backend for parsing
      url = null;
    }

    const form = new FormData();
    form.append("file", file);
  const res = await fetch((import.meta.env.VITE_API_BASE || "http://127.0.0.1:8011") + "/api/upload-resume", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setUploading(false);
    if (url) setUploaded(url);
    onUploaded({ ...data, url: url || undefined });
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">Resume</h3>
      <p className="text-sm text-gray-500 mb-2">Upload PDF/DOCX/TXT to auto-boost matching.</p>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e)=>{ if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          className="block"
          disabled={uploading}
        />
        {uploading ? (
          <span className="text-sm text-grey-600">Uploading…</span>
        ) : uploaded ? (
          <a href={uploaded} target="_blank" rel="noreferrer" className="text-sm text-grey-600 underline">Uploaded • Replace</a>
        ) : null}
      </div>
    </div>
  );
}
