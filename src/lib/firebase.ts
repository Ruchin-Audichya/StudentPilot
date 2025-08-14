// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

function trimOrEmpty(v: unknown): string {
  return (typeof v === "string" ? v.trim() : "");
}

// Normalize envs and fix common mistakes (e.g., storage bucket domain)
const RAW = {
  apiKey: trimOrEmpty(import.meta.env.VITE_FIREBASE_API_KEY) || "",
  authDomain: trimOrEmpty(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || "",
  projectId: trimOrEmpty(import.meta.env.VITE_FIREBASE_PROJECT_ID) || "",
  storageBucket: trimOrEmpty(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || "",
  messagingSenderId: trimOrEmpty(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || "",
  appId: trimOrEmpty(import.meta.env.VITE_FIREBASE_APP_ID) || "",
  measurementId: trimOrEmpty(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) || "",
};

let normalizedBucket = RAW.storageBucket;
if (!normalizedBucket && RAW.projectId) {
  normalizedBucket = `${RAW.projectId}.appspot.com`;
}
// If someone pasted *.firebasestorage.app, convert to the bucket name expected by SDK
if (normalizedBucket.endsWith(".firebasestorage.app") && RAW.projectId) {
  normalizedBucket = `${RAW.projectId}.appspot.com`;
}

const firebaseConfig = {
  apiKey: RAW.apiKey || "",
  authDomain: RAW.authDomain || "",
  projectId: RAW.projectId || "",
  storageBucket: normalizedBucket || "",
  messagingSenderId: RAW.messagingSenderId || "",
  appId: RAW.appId || "",
  measurementId: RAW.measurementId || undefined,
} as const;

// Initialize Firebase
// Prevent multiple inits in dev/HMR and add diagnostics for missing config
function assertConfig(cfg: typeof firebaseConfig) {
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push("VITE_FIREBASE_API_KEY");
  if (!cfg.authDomain) missing.push("VITE_FIREBASE_AUTH_DOMAIN");
  if (!cfg.projectId) missing.push("VITE_FIREBASE_PROJECT_ID");
  if (!cfg.appId) missing.push("VITE_FIREBASE_APP_ID");
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(
      `Firebase config incomplete: ${missing.join(", ")}. Check Render frontend env vars and redeploy.`
    );
  }
}

assertConfig(firebaseConfig);

const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Export Auth for use in AuthPage
export const auth = getAuth(app);

// Lightweight readiness flag: only true when required fields present
export const FIREBASE_READY = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

// Try to init Analytics only when supported and configured (no errors if unsupported)
(async () => {
  try {
    if (firebaseConfig.measurementId && (await isSupported())) {
      getAnalytics(app);
    }
  } catch {
    /* no-op */
  }
})();

// Optional: upload file to Firebase Storage and return a public URL
export async function uploadToStorage(file: File): Promise<string> {
  // If not configured, caller should have gated on FIREBASE_READY
  const storage = getStorage(app);
  const safeName = file.name.replace(/\s+/g, "_");
  const path = `resumes/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

export default app;
