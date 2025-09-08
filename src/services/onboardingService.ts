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
  // New optional fields
  phone?: string;
  links?: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
};

export type PreferencesPayload = {
  roles: string[];
  locations: string[];
  workMode?: "remote" | "hybrid" | "onsite";
  stipendMin?: number;
  stipendMax?: number;
  startDate?: string; // ISO date string
  companySize?: "small" | "mid" | "large";
  alerts?: { topics: string[]; freq: "off" | "daily" | "weekly" };
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
  phone: data.phone ?? "",
  links: data.links ?? {},
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

  // Light analytics (best-effort, guarded)
  try {
    if (FIREBASE_READY) {
      const mod = await import("firebase/analytics");
      if (await mod.isSupported()) {
        const appMod = await import("@/lib/firebase");
        const analytics = mod.getAnalytics((appMod as any).default);
        mod.logEvent(analytics, "onboarding_completed", { has_links: Boolean(data.links), skills_count: data.skills?.length ?? 0 });
      }
    }
  } catch { /* no-op */ }

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

// Save user preferences under users/{uid}/preferences
export async function savePreferences(prefs: PreferencesPayload): Promise<{ uid: string } | null> {
  if (!FIREBASE_READY || !auth || !db) return null;
  const user = await ensureAnonymousUser();
  if (!user) return null;
  const uid = user.uid;

  const prefRef = doc(db, `users/${uid}/preferences`, "profile");
  await setDoc(prefRef, {
    ...prefs,
    savedAt: serverTimestamp(),
  }, { merge: true });

  // Analytics event (best-effort)
  try {
    if (FIREBASE_READY) {
      const mod = await import("firebase/analytics");
      if (await mod.isSupported()) {
        const appMod = await import("@/lib/firebase");
        const analytics = mod.getAnalytics((appMod as any).default);
        mod.logEvent(analytics, "preferences_saved", {
          roles_count: prefs.roles?.length ?? 0,
          locations_count: prefs.locations?.length ?? 0,
          work_mode: prefs.workMode || "",
          alerts_freq: prefs.alerts?.freq || "",
        });
      }
    }
  } catch { /* no-op */ }

  return { uid };
}
