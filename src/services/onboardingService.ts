import { auth, db, ensureAnonymousUser, FIREBASE_READY } from "@/lib/firebase";
import { logUserEvent } from "@/lib/apiBase";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  linkWithCredential,
  type User,
} from "firebase/auth";

export type OnboardingPayload = {
  name: string;
  college?: string;
  branch?: string;
  year?: string;
  skills: string[];
  interests: string[];
  location?: string;
};

// Starts onboarding by ensuring an anonymous user exists. Returns the user (or null if Firebase not configured).
export async function startOnboarding(): Promise<User | null> {
  return await ensureAnonymousUser();
}

// Saves onboarding data to Firestore under users/{uid}/private/onboarding and also a top-level users/{uid} profile snapshot.
export async function saveOnboardingData(data: OnboardingPayload): Promise<{ uid: string } | null> {
  if (!FIREBASE_READY || !auth || !db) return null;
  const user = await ensureAnonymousUser();
  if (!user) return null;
  const uid = user.uid;

  // Minimal schema: public profile and a private onboarding doc.
  const userDocRef = doc(db, "users", uid);
  const privateOnboardingRef = doc(db, `users/${uid}/private`, "onboarding");

  await Promise.all([
    setDoc(userDocRef, {
      name: data.name ?? "",
      location: data.location ?? "",
      skills: data.skills ?? [],
      interests: data.interests ?? [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true }),
    setDoc(privateOnboardingRef, {
      ...data,
      savedAt: serverTimestamp(),
    }, { merge: true }),
  ]);

  // Fire and forget user log
  logUserEvent({ uid, isAnonymous: user.isAnonymous, email: user.email });

  return { uid };
}

// Links the current (possibly anonymous) user with email/password, preserving data.
export async function linkAnonymousAccount(email: string, password: string): Promise<User | null> {
  if (!FIREBASE_READY || !auth) return null;
  const user = auth.currentUser;
  if (!user) return null;

  const credential = EmailAuthProvider.credential(email, password);
  const linked = await linkWithCredential(user, credential);
  return linked.user;
}
