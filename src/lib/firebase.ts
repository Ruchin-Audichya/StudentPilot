// Lightweight Firebase init with optional Anonymous Auth and Storage.
// It activates only when VITE_FIREBASE_ENABLED=true and required env vars exist.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  linkWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { getStorage, type FirebaseStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getFirestore, type Firestore, doc, setDoc } from "firebase/firestore";

const enabled = (import.meta.env.VITE_FIREBASE_ENABLED || "false").toString().toLowerCase() === "true";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function hasConfig(obj: Record<string, unknown>) {
  return Object.values(obj).every((v) => typeof v === "string" && !!v);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let db: Firestore | null = null;

export const FIREBASE_READY = enabled && hasConfig(config);

if (FIREBASE_READY) {
  app = initializeApp(config);
  auth = getAuth(app);
  storage = getStorage(app);
  db = getFirestore(app);
  // persist session across restarts
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export async function ensureSignedIn(): Promise<string | null> {
  if (!FIREBASE_READY || !auth) return null;
  if (!auth.currentUser) await signInAnonymously(auth).catch(() => {});
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth!, (u) => {
      if (u) {
        unsub();
        resolve(u.uid);
      }
    });
  });
}

export async function uploadToStorage(file: File, pathPrefix = "resumes"): Promise<string | null> {
  if (!FIREBASE_READY || !storage) return null;
  const uid = (await ensureSignedIn()) || "anon";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${pathPrefix}/${uid}/${Date.now()}_${safeName}`;
  const r = ref(storage, path);
  const task = uploadBytesResumable(r, file, { contentType: file.type });
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", undefined, reject, () => resolve());
  });
  return await getDownloadURL(task.snapshot.ref);
}

export async function signUpWithEmailPassword(email: string, password: string, displayName?: string): Promise<string> {
  if (!FIREBASE_READY || !auth) throw new Error("Firebase not configured");
  // If currently anonymous, try linking the credential
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    const cred = EmailAuthProvider.credential(email, password);
    const res = await linkWithCredential(auth.currentUser, cred);
    if (displayName) await updateProfile(res.user, { displayName }).catch(() => {});
    return res.user.uid;
  }
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(res.user, { displayName }).catch(() => {});
    return res.user.uid;
  } catch (err: any) {
    // If already exists, sign in instead
    const res = await signInWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(res.user, { displayName }).catch(() => {});
    return res.user.uid;
  }
}

export async function saveUserProfile(uid: string, data: Record<string, unknown>): Promise<void> {
  if (!FIREBASE_READY || !db) return;
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

export { auth, storage, db };
