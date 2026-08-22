import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { getFirebaseDb } from "@/config/firebase";
import { doc, getDoc, type DocumentReference } from "firebase/firestore";
import { firestoreConverter } from "@/types/firestore";
import { type UserDoc, createFirestoreService } from "@/lib/FirestoreService";
import { writeStorageValue } from "@/lib/storage";
import { usePreferencesStore } from "@/store/profile/usePreferencesStore";
import type { Theme } from "@/constants/theme";
import { THEME_OPTIONS } from "@/constants/theme";

function profileUserRef(uid: string): DocumentReference<UserDoc> {
  return doc(getFirebaseDb()!, "users", uid).withConverter(
    firestoreConverter<UserDoc>(),
  );
}

export interface UsePreferencesReturn {
  theme: string;
  setTheme: (value: string) => void;
  prefsSaved: boolean;
  prefsSaving: boolean;
  prefsError: string;
  hasPreferenceChanges: boolean;
  handleSavePreferences: () => Promise<void>;
  refreshing: boolean;
  refresh: () => void;
}

export function usePreferences(): UsePreferencesReturn {
  const { user } = useAuthStore();
  const theme = usePreferencesStore((state) => state.theme);
  const preferenceSnapshot = usePreferencesStore(
    (state) => state.preferenceSnapshot,
  );
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const setPreferences = usePreferencesStore((state) => state.setPreferences);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const hasPreferenceChanges = useMemo(() => {
    return preferenceSnapshot?.theme !== theme;
  }, [theme, preferenceSnapshot]);

  const handleSavePreferences = useCallback(async () => {
    if (prefsSaving || !user) {
      return;
    }
    setPrefsError("");
    setPrefsSaved(false);
    setPrefsSaving(true);
    try {
      await createFirestoreService(user.uid).updateUserPreferences({
        theme,
      });

      const resolvedTheme =
        theme === THEME_OPTIONS.SYSTEM
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? THEME_OPTIONS.DARK
            : THEME_OPTIONS.LIGHT
          : theme;
      writeStorageValue("polymorpha-theme", resolvedTheme);
      document.documentElement.dataset.theme = resolvedTheme;

      setPreferences({ theme });

      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch (err: unknown) {
      const code =
        err instanceof Error && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (
        code.includes("resource-exhausted") ||
        code.includes("too-many-requests")
      ) {
        setPrefsError(
          "API limit reached right now. Please wait a moment and try again.",
        );
      } else {
        setPrefsError("Failed to save preferences. Please try again.");
      }
    } finally {
      setPrefsSaving(false);
    }
  }, [theme, prefsSaving, user, setPreferences]);

  const refresh = useCallback(async () => {
    if (!user) {
      return;
    }

    const db = getFirebaseDb();
    if (!db) {
      return;
    }

    setRefreshing(true);

    try {
      const snap = await getDoc(profileUserRef(user.uid));
      const d = snap.data();

      if (d) {
        setPreferences({
          theme: (d.preferences?.theme ?? THEME_OPTIONS.SYSTEM) as Theme,
        });
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[polymorpha]", e);
      }
    } finally {
      setRefreshing(false);
    }
  }, [user, setPreferences]);

  useEffect(() => {
    const resolved =
      theme === THEME_OPTIONS.SYSTEM
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? THEME_OPTIONS.DARK
          : THEME_OPTIONS.LIGHT
        : theme;
    document.documentElement.dataset.theme = resolved;
    writeStorageValue("polymorpha-theme", resolved);
  }, [theme]);

  return {
    theme,
    setTheme,
    hasPreferenceChanges,
    handleSavePreferences,
    prefsSaving,
    prefsSaved,
    prefsError,
    refreshing,
    refresh,
  };
}
