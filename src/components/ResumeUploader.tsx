
type Props = {
  onUploaded: (result: { status: string; chars: number; preview: string }) => void;
};

export default function ResumeUploader({ onUploaded }: Props) {
  async function handleFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch((import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000") + "/api/upload-resume", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    onUploaded(data);
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">Resume</h3>
      <p className="text-sm text-gray-500 mb-2">Upload PDF/DOCX/TXT to auto-boost matching.</p>
      <input
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={e=>{ if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        className="block"
      />
    </div>
  );
}
