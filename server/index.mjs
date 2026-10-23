import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createApp } from './app.mjs';

const authMode = process.env.JOB_AUTH_MODE || 'firebase';
if (!['local', 'firebase'].includes(authMode)) throw new Error('JOB_AUTH_MODE must be local or firebase.');
const localToken = process.env.JOB_LOCAL_TOKEN || randomBytes(32).toString('hex');
const config = {
  authMode, localToken, dataDir: process.env.JOB_DATA_DIR || '.studentpilot/jobs',
  origins: (process.env.JOB_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  braveKey: process.env.BRAVE_SEARCH_API_KEY, openaiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL,
  latexImage: process.env.LATEX_IMAGE || 'studentpilot-latex:local',
  enableBrowser: process.env.ENABLE_APPLICATION_BROWSER === 'true',
};
const port = Number(process.env.JOB_API_PORT || 8787);
const host = process.env.JOB_API_HOST || '127.0.0.1';
createApp(config).listen(port, host, () => {
  console.log(`StudentPilot job service: http://${host}:${port}`);
  if (authMode === 'local') console.log(`Local access token (paste into Job Search): ${localToken}`);
});
