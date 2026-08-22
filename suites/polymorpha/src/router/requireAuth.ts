/**
 * React Router 7 loader guard for workspace routes.
 * Redirects unauthenticated users to /login with a ?next= param.
 * Waits for Firebase to restore a persisted session before checking.
 */
import { redirect } from "react-router-dom";
import { getFirebaseAuth } from "@/config/firebase";

export async function requireAuth() {
  const auth = getFirebaseAuth();
  if (!auth) {
    // Firebase not initialised — allow access in dev, redirect in prod
    if (import.meta.env.DEV) return null;
    throw redirect("/login");
  }

  // Wait for Firebase to restore persisted session
  await auth.authStateReady();

  if (!auth.currentUser) {
    const next = window.location.pathname + window.location.search;
    throw redirect("/login?next=" + encodeURIComponent(next));
  }
  return null;
}
