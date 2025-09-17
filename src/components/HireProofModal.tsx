import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { submitTestimonial } from '@/services/testimonials';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function HireProofModal({ open, onClose, onSubmitted }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await submitTestimonial({ name, role, company, message, file });
      setLoading(false);
      onSubmitted?.();
      onClose();
      setName(''); setRole(''); setCompany(''); setMessage(''); setFile(null);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Submission failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Got hired via Find My Stipend?</DialogTitle>
          <DialogDescription>Congrats! Share a short note and (optional) blurred offer letter screenshot.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-300">Your Name</label>
              <Input value={name} onChange={(e:any) => setName(e.target.value)} placeholder="Aarav S." required />
            </div>
            <div>
              <label className="text-sm text-gray-300">Role</label>
              <Input value={role} onChange={(e:any) => setRole(e.target.value)} placeholder="SWE Intern" />
            </div>
            <div>
              <label className="text-sm text-gray-300">Company</label>
              <Input value={company} onChange={(e:any) => setCompany(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-sm text-gray-300">Proof (image)</label>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-300">Short testimonial</label>
            <Textarea value={message} onChange={(e:any) => setMessage(e.target.value)} placeholder="Got my SWE internship after optimizing my resume with FMS!" required />
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
