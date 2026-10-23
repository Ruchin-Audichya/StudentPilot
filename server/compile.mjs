import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateLatex } from './tailor.mjs';

const exec = promisify(execFile);
export async function compilerAvailable(image = 'studentpilot-latex:local') {
  try { await exec('docker', ['image', 'inspect', image], { timeout: 5000 }); return true; }
  catch { return false; }
}

export async function compileLatex(latex, image = 'studentpilot-latex:local') {
  validateLatex(latex);
  const dir = await mkdtemp(path.join(tmpdir(), 'studentpilot-tex-'));
  const container = `studentpilot-tex-${randomUUID()}`;
  try {
    await writeFile(path.join(dir, 'resume.tex'), latex, { mode: 0o600 });
    await exec('docker', [
      'run', '--rm', '--name', container, '--network', 'none', '--read-only',
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--memory', '512m', '--cpus', '1', '--pids-limit', '64',
      '--user', `${process.getuid()}:${process.getgid()}`, '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
      '--mount', `type=bind,src=${dir},dst=/work`, '-w', '/work', image,
      'pdflatex', '-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', 'resume.tex',
    ], { timeout: 45_000, maxBuffer: 1_000_000 });
    const log = await readFile(path.join(dir, 'resume.log'), 'utf8');
    if (/Overfull \\[hv]box/.test(log)) throw new Error('The reconstructed layout overflows. Edit the LaTeX and recompile before applying.');
    const pdf = await readFile(path.join(dir, 'resume.pdf'));
    if (pdf.length > 8_000_000 || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Compiler returned an invalid PDF.');
    return pdf;
  } catch (error) {
    if (error.message?.startsWith('The reconstructed')) throw error;
    throw new Error('PDF compilation failed. Build the compiler image and review the downloadable LaTeX for errors.');
  } finally {
    await exec('docker', ['rm', '-f', container], { timeout: 5000 }).catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
}
