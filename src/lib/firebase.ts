// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth as FirebaseAuth,
  signInAnonymously,
  type User,
} from "firebase/auth";
// Note: import analytics dynamically only when config is valid to avoid runtime errors
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

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

// Lightweight readiness flag: only true when required fields present
export const FIREBASE_READY = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

// Export Auth for use in AuthPage
// Avoid initializing Auth when config is incomplete to prevent runtime crashes
export const auth: FirebaseAuth | null = FIREBASE_READY ? getAuth(app) : (null as unknown as FirebaseAuth);

// Optional helper for guarded access
export function getAuthOrThrow(): FirebaseAuth {
  if (!FIREBASE_READY) {
    throw new Error("Firebase not configured. Set VITE_FIREBASE_* envs and redeploy.");
  }
  return getAuth(app);
}

// Firestore instance export (guarded by FIREBASE_READY)
export const db: Firestore | null = FIREBASE_READY ? getFirestore(app) : (null as unknown as Firestore);

// Ensure there's an authenticated user; if no user, sign in anonymously.
// Returns the current user (anonymous or permanent). Safe no-op if Firebase isn't configured.
export async function ensureAnonymousUser(): Promise<User | null> {
  if (!FIREBASE_READY) return null;
  const a = getAuthOrThrow();
  if (!a.currentUser) {
    const cred = await signInAnonymously(a);
    return cred.user;
  }
  return a.currentUser;
}

// Initialize Analytics only when FIREBASE_READY to avoid auth/invalid-api-key crashes
if (FIREBASE_READY && firebaseConfig.measurementId) {
  (async () => {
    try {
      const analyticsMod = await import("firebase/analytics");
      if (analyticsMod && (await analyticsMod.isSupported())) {
        analyticsMod.getAnalytics(app);
      }
    } catch {
      /* no-op */
    }
  })();
}

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
