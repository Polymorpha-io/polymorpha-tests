import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject, listAll } from "firebase/storage";
import {
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import { useAuthStore } from "@/store/useAuthStore";
import {
  getFirebaseDb,
  getFirebaseStorage,
  getFirebaseAuth,
} from "@/config/firebase";

const deleteStorageTree = async (path: string): Promise<void> => {
  const storage = getFirebaseStorage();
  if (!storage) return;
  try {
    const root = ref(storage, path);
    const listing = await listAll(root);
    for (const itemRef of listing.items) {
      try {
        await deleteObject(itemRef);
      } catch {
        // ignore
      }
    }
    for (const prefixRef of listing.prefixes) {
      await deleteStorageTree(prefixRef.fullPath);
    }
  } catch {
    // ignore
  }
};

export interface UseAccountDeletionReturn {
  deleting: boolean;
  deleteError: string | null;
  isGoogleUser: boolean;
  handleDelete: (password?: string) => void;
}

export function useAccountDeletion(): UseAccountDeletionReturn {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isGoogleUser =
    user?.providerData.some((p) => p.providerId === "google.com") ?? false;

  const verifyCredentials = useCallback(
    async (
      currentUser: User,
      password?: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (isGoogleUser) {
        try {
          await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
          return { ok: true };
        } catch {
          return {
            ok: false,
            error: "Re-authentication was cancelled. Account was not deleted.",
          };
        }
      }

      if (!password) {
        return {
          ok: false,
          error: "Enter your password to confirm account deletion.",
        };
      }

      const credential = EmailAuthProvider.credential(
        currentUser.email!,
        password,
      );
      try {
        await reauthenticateWithCredential(currentUser, credential);
        return { ok: true };
      } catch (reAuthErr: unknown) {
        const code =
          reAuthErr instanceof Error && "code" in reAuthErr
            ? (reAuthErr as { code: string }).code
            : "";

        if (
          code === "auth/wrong-password" ||
          code === "auth/invalid-credential"
        ) {
          return {
            ok: false,
            error: "Incorrect password. Please try again.",
          };
        }
        return {
          ok: false,
          error: "Re-authentication failed. Please try again.",
        };
      }
    },
    [isGoogleUser],
  );

  const performDeletion = useCallback(
    async (currentUser: User, uid: string) => {
      try {
        const db = getFirebaseDb();

        await Promise.all([
          deleteStorageTree(`users/${uid}/datasets`),
          deleteStorageTree(`users/${uid}/exports`),
          deleteStorageTree(`users/${uid}/avatars`),
        ]);

        if (db) {
          const uploadsSnap = await getDocs(
            collection(db, "users", uid, "uploads"),
          );
          for (const d of uploadsSnap.docs) await deleteDoc(d.ref);
          const exportsSnap = await getDocs(
            collection(db, "users", uid, "exports"),
          );
          for (const d of exportsSnap.docs) await deleteDoc(d.ref);
          await deleteDoc(doc(db, "users", uid));
        }

        await currentUser.delete();
        navigate("/");
      } catch {
        setDeleteError("Failed to delete account. Please try again.");
      } finally {
        setDeleting(false);
      }
    },
    [navigate],
  );

  const handleDelete = useCallback(
    async (password?: string) => {
      const currentUser = getFirebaseAuth()?.currentUser;

      if (!currentUser || !user) {
        return;
      }

      setDeleting(true);
      setDeleteError(null);

      const verified = await verifyCredentials(currentUser, password);
      if (!verified.ok) {
        setDeleteError(verified.error);
        setDeleting(false);
        return;
      }

      await performDeletion(currentUser, user.uid);
    },
    [user, verifyCredentials, performDeletion],
  );

  return {
    deleting,
    deleteError,
    isGoogleUser,
    handleDelete,
  };
}
