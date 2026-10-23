import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export class Store {
  constructor(root) { this.root = path.resolve(root); }
  directory(user) { return path.join(this.root, createHash('sha256').update(user).digest('hex')); }
  async read(user) {
    try { return JSON.parse(await readFile(path.join(this.directory(user), 'state.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; return { profile: {}, jobs: [], applications: [], resume: null, coverage: [], connections: {} }; }
  }
  async write(user, state) {
    const dir = this.directory(user);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const temp = path.join(dir, `${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(temp, path.join(dir, 'state.json'));
  }
  async file(user, name, bytes) {
    const dir = this.directory(user);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(dir, name), bytes, { mode: 0o600 });
  }
}

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const submittedStates = new Set(['submitting', 'submitted', 'submission_unknown', 'submitted_manually']);
export function canTailor(application) { return !application || !submittedStates.has(application.status); }
export function canApply(application) {
  return application && ['ready', 'needs_input'].includes(application.status)
    && Boolean(application.pdfHash) && application.reviewedHash === application.pdfHash;
}
