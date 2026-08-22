import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateEmail,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/config/firebase";
import { createFirestoreService } from "@/lib/FirestoreService";
import {
  readStorageValue,
  removeStorageValue,
  writeStorageValue,
} from "@/lib/storage";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  storageBucket?: string;
  createdAt: Date;
  providerData: Array<{ providerId: string }>;
}

interface AuthStore {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    storageBucket: string,
    storageConsent?: boolean,
    region?: string,
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetError: () => void;

  resetPassword: (email: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  changeEmail: (newEmail: string) => Promise<void>;
  updateUserProfile: (
    displayName: string | null,
    photoURL: string | null,
  ) => Promise<void>;
}

function firebaseUserToProfile(user: FirebaseUser): UserProfile {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    storageBucket:
      "storageBucket" in user
        ? ((user as Record<string, unknown>).storageBucket as
            string | undefined)
        : undefined,
    createdAt: new Date(user.metadata.creationTime ?? Date.now()),
    providerData: user.providerData.map((p) => ({ providerId: p.providerId })),
  };
}

function getAuthErrorMessage(err: unknown): string {
  if (import.meta.env.DEV && err instanceof Error) {
    const codeForLog =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      typeof (err as Record<string, unknown>).code === "string"
        ? (err as Record<string, unknown>).code
        : "(no code)";
    console.error("[auth]", codeForLog, err.message);
  }
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";

  if (code === "auth/invalid-credential") return "Invalid email or password.";
  if (code === "auth/email-already-in-use")
    return "This email is already registered.";
  if (code === "auth/weak-password")
    return "Password must be at least 8 characters and include upper, lower, number, and symbol.";
  if (code === "auth/user-not-found")
    return "No account found with this email.";
  if (code === "auth/wrong-password") return "Incorrect password.";
  if (code === "auth/popup-closed-by-user") return "Sign-in popup was closed.";
  if (code === "auth/configuration-not-found")
    return "Google Sign-in is not enabled in Firebase for this project.";
  if (code === "auth/account-exists-with-different-credential")
    return "This email already exists with another sign-in method. Sign in with email/password once, then try Google again to link it.";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait a bit and try again.";
  if (code === "auth/network-request-failed")
    return "Network error — check your connection and try again.";
  if (code === "auth/invalid-api-key")
    return "Firebase configuration error — invalid API key.";
  if (code === "auth/unauthorized-domain")
    return "This domain is not authorized for authentication.";
  if (code === "auth/operation-not-allowed")
    return "Email/password sign-in is not enabled in the Firebase console.";

  if (err instanceof Error) {
    if (err.message.includes("auth/invalid-credential"))
      return "Invalid email or password.";
    if (err.message.includes("auth/email-already-in-use"))
      return "This email is already registered.";
    if (err.message.includes("auth/weak-password"))
      return "Password must be at least 8 characters and include upper, lower, number, and symbol.";
    if (err.message.includes("auth/user-not-found"))
      return "No account found with this email.";
    if (err.message.includes("auth/wrong-password"))
      return "Incorrect password.";
    if (err.message.includes("auth/popup-closed-by-user"))
      return "Sign-in popup was closed.";
    if (err.message.includes("auth/configuration-not-found"))
      return "Google Sign-in is not enabled in Firebase for this project.";
    if (err.message.includes("auth/account-exists-with-different-credential"))
      return "This email already exists with another sign-in method. Sign in with email/password once, then try Google again to link it.";
    const cleaned = err.message
      .replace(/Firebase:\s*([^(]+)\s*\(auth\/[^)]+\)\.?/, "$1")
      .trim();
    if (!cleaned || cleaned.toLowerCase() === "error") {
      return code
        ? `Authentication failed (${code}). Please try again.`
        : "Authentication failed. Please try again.";
    }
    return code ? `${cleaned} (${code})` : cleaned;
  }
  return code
    ? `Authentication error (${code}). Please try again.`
    : "An unexpected authentication error occurred.";
}

const pendingGoogleCredentialKey = "polymorpha.pendingGoogleCredential";

type PendingGoogleCredential = {
  idToken?: string;
  accessToken?: string;
  email?: string;
};

function getErrorCode(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    return String((err as { code?: unknown }).code ?? "");
  }
  return "";
}

function stashPendingGoogleCredential(
  err: unknown,
): PendingGoogleCredential | null {
  if (getErrorCode(err) !== "auth/account-exists-with-different-credential")
    return null;
  const credential = GoogleAuthProvider.credentialFromError(
    err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0],
  );
  if (!credential?.idToken && !credential?.accessToken) return null;
  const email =
    typeof err === "object" && err !== null && "customData" in err
      ? String(
          (err as { customData?: { email?: string } }).customData?.email ?? "",
        )
      : "";
  const pending: PendingGoogleCredential = {
    idToken: credential.idToken ?? undefined,
    accessToken: credential.accessToken ?? undefined,
    email: email || undefined,
  };
  try {
    if (
      !writeStorageValue(
        pendingGoogleCredentialKey,
        JSON.stringify(pending),
        "session",
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return pending;
}

function takePendingGoogleCredential(): PendingGoogleCredential | null {
  try {
    const raw = readStorageValue(pendingGoogleCredentialKey, "session");
    if (!raw) return null;
    removeStorageValue(pendingGoogleCredentialKey, "session");
    const parsed = JSON.parse(raw) as PendingGoogleCredential;
    if (!parsed.idToken && !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function linkPendingGoogleIfPresent(
  user: FirebaseUser,
): Promise<boolean> {
  const pending = takePendingGoogleCredential();
  if (!pending) return false;
  const credential = GoogleAuthProvider.credential(
    pending.idToken ?? null,
    pending.accessToken ?? null,
  );
  try {
    await linkWithCredential(user, credential);
    return true;
  } catch (err) {
    const code = getErrorCode(err);
    if (
      code === "auth/provider-already-linked" ||
      code === "auth/credential-already-in-use"
    ) {
      return true;
    }
    try {
      writeStorageValue(
        pendingGoogleCredentialKey,
        JSON.stringify(pending),
        "session",
      );
    } catch {
      // ignore restore failures
    }
    return false;
  }
}

async function ensureUserDoc(
  user: FirebaseUser,
  storageBucket?: string,
  storageConsent?: boolean,
  region?: string,
): Promise<void> {
  try {
    const provider =
      user.providerData[0]?.providerId === "google.com" ? "google" : "email";
    await createFirestoreService(user.uid).ensureUserDoc({
      email: user.email ?? "",
      displayName: user.displayName,
      photoURL: user.photoURL,
      provider: provider as "email" | "google",
      storageBucket,
      storageConsent,
      region,
    });
  } catch (err) {
    if (import.meta.env.DEV)
      console.error("Failed to create/fetch user document in Firestore:", err);
  }
}

/** Guard flag  prevents syncBestAvatar from racing with an in-flight updateUserProfile call. */
let _avatarUpdateInProgress = false;

async function syncBestAvatar(user: FirebaseUser): Promise<void> {
  if (_avatarUpdateInProgress) return;
  const db = getFirebaseDb();
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;
    const dbPhoto: string | null =
      (snap.data().photoURL as string | null) || null;
    const authPhoto: string | null = user.photoURL || null;
    const best = dbPhoto || authPhoto || null;
    if (!best) return;
    if (authPhoto !== best) {
      await updateProfile(user, {
        displayName: user.displayName,
        photoURL: best,
      });
    }
    if (dbPhoto !== best) {
      await setDoc(
        doc(db, "users", user.uid),
        { photoURL: best, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  } catch {
    /* avatar sync non-critical */
  }
}

export const useAuthStore = create<AuthStore>((set, _get) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  signIn: async (email, password) => {
    const auth = getFirebaseAuth();
    if (!auth) {
      set({ error: "Auth not available" });
      return;
    }
    set({ loading: true, error: null });
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const linked = await linkPendingGoogleIfPresent(cred.user);
      if (linked) await syncBestAvatar(cred.user);
      set({
        user: firebaseUserToProfile(cred.user),
        loading: false,
      });
      ensureUserDoc(cred.user);
    } catch (err: unknown) {
      set({ error: getAuthErrorMessage(err), loading: false });
    }
  },

  signUp: async (
    email,
    password,
    displayName,
    storageBucket,
    storageConsent,
    region,
  ) => {
    const auth = getFirebaseAuth();
    if (!auth) {
      set({ error: "Auth not available" });
      return;
    }
    set({ loading: true, error: null });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      set({
        user: firebaseUserToProfile(cred.user),
        loading: false,
      });
      ensureUserDoc(cred.user, storageBucket, storageConsent, region);
      sendEmailVerification(cred.user).catch((e) => {
        if (import.meta.env.DEV) console.warn("[polymorpha]", e);
      });
    } catch (err) {
      set({ error: getAuthErrorMessage(err), loading: false });
    }
  },

  signInWithGoogle: async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      set({ error: "Auth not available" });
      return;
    }
    set({ loading: true, error: null });
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const currentUser = auth.currentUser;
      if (
        currentUser &&
        !currentUser.providerData.some((p) => p.providerId === "google.com")
      ) {
        await linkWithRedirect(currentUser, provider);
        return;
      }
      await signInWithPopup(auth, provider);
      set({ loading: false });
    } catch (err: unknown) {
      const code = getErrorCode(err);
      if (code === "auth/account-exists-with-different-credential") {
        stashPendingGoogleCredential(err);
        set({
          error:
            "This email is already registered with password login. Sign in with email/password once and we will link Google automatically.",
          loading: false,
        });
        return;
      }
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user"
      ) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          set({ error: getAuthErrorMessage(redirectErr), loading: false });
          return;
        }
      }
      set({ error: getAuthErrorMessage(err), loading: false });
    }
  },

  signOut: async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await firebaseSignOut(auth);
    removeStorageValue(pendingGoogleCredentialKey, "session");
    set({ user: null, error: null });
  },

  resetError: () => set({ error: null }),

  resetPassword: async (email) => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    set({ loading: true, error: null });
    try {
      await sendPasswordResetEmail(auth, email);
      set({ loading: false });
    } catch (err) {
      set({ error: getAuthErrorMessage(err), loading: false });
    }
  },

  verifyEmail: async () => {
    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser) return;
    set({ loading: true, error: null });
    try {
      await sendEmailVerification(auth.currentUser);
      set({ loading: false });
    } catch (err) {
      set({ error: getAuthErrorMessage(err), loading: false });
    }
  },

  changeEmail: async (newEmail) => {
    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser) return;
    set({ loading: true, error: null });
    try {
      await updateEmail(auth.currentUser, newEmail);
      set({
        user: firebaseUserToProfile(auth.currentUser),
        loading: false,
      });
    } catch (err) {
      set({ error: getAuthErrorMessage(err), loading: false });
    }
  },

  updateUserProfile: async (displayName, photoURL) => {
    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser) return;
    _avatarUpdateInProgress = true;
    set({ loading: true, error: null });
    try {
      const db = getFirebaseDb();
      if (db) {
        await setDoc(
          doc(db, "users", auth.currentUser.uid),
          {
            displayName,
            photoURL,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
      await updateProfile(auth.currentUser, { displayName, photoURL });
      set({
        user: firebaseUserToProfile(auth.currentUser),
        loading: false,
      });
    } catch (err) {
      set({ error: getAuthErrorMessage(err), loading: false });
    } finally {
      _avatarUpdateInProgress = false;
    }
  },
}));

/**
 * Initialize auth state listener. Call once at app startup.
 * Listens to Firebase auth state changes and syncs to the store.
 */
export function initAuthListener(): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    useAuthStore.setState({ initialized: true });
    return () => {};
  }

  getRedirectResult(auth)
    .then(async (cred) => {
      if (cred?.user) {
        ensureUserDoc(cred.user);
        await syncBestAvatar(cred.user);
        useAuthStore.setState({ user: firebaseUserToProfile(cred.user) });
      }
    })
    .catch(async (err: unknown) => {
      const pending = stashPendingGoogleCredential(err);
      if (!pending) return;

      let message =
        "This email already has another sign-in method. Sign in with your password and Google will be linked automatically.";
      if (pending.email) {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, pending.email);
          if (methods.includes("password")) {
            message =
              "This email already uses password sign-in. Log in with email/password once, then click Continue with Google again to finish linking.";
          }
        } catch {
          // Keep generic guidance if provider lookup fails.
        }
      }
      useAuthStore.setState({ error: message, loading: false });
    });

  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      useAuthStore.setState({
        user: firebaseUserToProfile(firebaseUser),
        initialized: true,
      });
      ensureUserDoc(firebaseUser);
      syncBestAvatar(firebaseUser);
      createFirestoreService(firebaseUser.uid)
        .touchOnline()
        .catch(() => {
          if (import.meta.env.DEV) console.warn("[auth] touchOnline failed");
        });
    } else {
      useAuthStore.setState({ user: null, initialized: true });
    }
  });

  return unsubscribe;
}
