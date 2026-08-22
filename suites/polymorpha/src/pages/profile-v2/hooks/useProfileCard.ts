import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  type SyntheticEvent,
} from "react";
import { useAuthStore, type UserProfile } from "@/store/useAuthStore";
import { useNavigate } from "react-router-dom";
import {
  ref,
  deleteObject,
  uploadBytes,
  getDownloadURL,
  listAll,
} from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/config/firebase";
import { toast } from "sonner";

export function isCustomAvatar(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }

  return (
    url.includes("firebasestorage.googleapis.com") ||
    url.includes("firebasestorage.app")
  );
}

export interface UseProfileCardReturn {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  resetError: () => void;

  avatarFile: File | null;
  setAvatarFile: Dispatch<SetStateAction<File | null>>;
  uploadingAvatar: boolean;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  avatarPreviewUrl: string | null;

  isEditingProfile: boolean;
  setIsEditingProfile: Dispatch<SetStateAction<boolean>>;
  newDisplayName: string;
  setNewDisplayName: Dispatch<SetStateAction<string>>;

  isEditingEmail: boolean;
  setIsEditingEmail: Dispatch<SetStateAction<boolean>>;
  newEmail: string;
  setNewEmail: Dispatch<SetStateAction<string>>;
  emailMessage: string;
  setEmailMessage: Dispatch<SetStateAction<string>>;
  emailVerified: boolean;

  displayNameText: string;
  avatarAlt: string;
  isCustomAvatar: (url: string | null | undefined) => boolean;

  // Email callbacks
  handleVerifyEmail: () => Promise<void>;
  handleUpdateEmail: (e: SyntheticEvent) => Promise<void>;

  // Auth / Profile callbacks
  handleSignOut: () => Promise<void>;
  handleUpdateProfile: (e: SyntheticEvent) => Promise<void>;

  // Avatar callbacks
  handleAvatarChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveAvatar: () => Promise<void>;
}

export function useProfileCard(): UseProfileCardReturn {
  const {
    user,
    signOut,
    verifyEmail,
    changeEmail,
    loading,
    error,
    resetError,
  } = useAuthStore();

  const navigate = useNavigate();

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const emailVerified = getFirebaseAuth()?.currentUser?.emailVerified ?? false;
  const displayNameText = (user?.displayName ?? "User").trim();
  const avatarAlt =
    user?.displayName?.trim() || user?.email?.trim() || "User avatar";

  const avatarPreviewUrl = useMemo(() => {
    if (!avatarFile) {
      return null;
    }
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  // Callbacks: Email
  const handleVerifyEmail = async () => {
    const toastId = toast.loading("Sending verification...");

    await verifyEmail();

    toast.dismiss(toastId);

    if (!useAuthStore.getState().error) {
      setEmailMessage(
        "Verification email sent! Please check your inbox (and your spam folder).",
      );

      toast.success("Verification email sent!");
    } else if (useAuthStore.getState().error) {
      toast.error(useAuthStore.getState().error);
    }
  };

  const handleUpdateEmail = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!newEmail) {
      return;
    }
    const toastId = toast.loading("Updating email...");

    await changeEmail(newEmail);

    toast.dismiss(toastId);

    if (!useAuthStore.getState().error) {
      setEmailMessage("Email updated successfully.");
      setIsEditingEmail(false);
      setNewEmail("");

      toast.success("Email updated");
    } else if (useAuthStore.getState().error) {
      toast.error(useAuthStore.getState().error);
    }
  };

  // Callbacks: Auth / Profile
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleUpdateProfile = async (e: SyntheticEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Updating profile...");

    await useAuthStore
      .getState()
      .updateUserProfile(newDisplayName || null, user?.photoURL || null);

    toast.dismiss(toastId);

    if (!useAuthStore.getState().error) {
      setIsEditingProfile(false);

      toast.success("Profile updated");
    } else if (useAuthStore.getState().error) {
      toast.error(useAuthStore.getState().error);
    }
  };

  // Callbacks: Avatar
  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      useAuthStore.setState({
        error: "Please select a valid image (JPEG or PNG).",
      });
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      useAuthStore.setState({ error: "Avatar image must be under 2 MB." });
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
      return;
    }

    setUploadingAvatar(true);
    setAvatarFile(file);

    const storage = getFirebaseStorage();
    if (!storage) {
      useAuthStore.setState({ error: "Storage is not configured." });
      setAvatarFile(null);
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
      return;
    }

    const toastId = toast.loading("Uploading profile picture...");
    try {
      try {
        const avatarsRef = ref(storage, `users/${user?.uid}/avatars`);
        const existing = await listAll(avatarsRef);
        await Promise.all(existing.items.map((item) => deleteObject(item)));
      } catch {
        /* old files may not exist */
      }

      const fileExtension = (file.name.split(".").pop() || "jpg").toLowerCase();
      const fileRef = ref(
        storage,
        `users/${user?.uid}/avatars/avatar_${Date.now()}.${fileExtension}`,
      );
      await uploadBytes(fileRef, file);
      const newPhotoURL = await getDownloadURL(fileRef);
      await useAuthStore
        .getState()
        .updateUserProfile(user?.displayName || null, newPhotoURL);
      setAvatarFile(null);

      toast.dismiss(toastId);
      toast.success("Profile picture updated");
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Avatar upload failed", err);
      }
      useAuthStore.setState({
        error: "Failed to upload avatar image. Please try again.",
      });

      toast.dismiss(toastId);
      toast.error("Failed to upload avatar image. Please try again.");

      setAvatarFile(null);
    }
    setUploadingAvatar(false);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.photoURL) {
      return;
    }
    setUploadingAvatar(true);
    setAvatarFile(null);

    const storage = getFirebaseStorage();
    if (storage) {
      try {
        const avatarsRef = ref(storage, `users/${user?.uid}/avatars`);
        const existing = await listAll(avatarsRef);
        await Promise.all(existing.items.map((item) => deleteObject(item)));
      } catch {
        /* non-critical */
      }
    }

    try {
      await useAuthStore
        .getState()
        .updateUserProfile(user?.displayName || null, null);
    } catch {
      useAuthStore.setState({ error: "Failed to remove avatar." });
    }
    setUploadingAvatar(false);
  };

  return {
    // Auth
    user,
    loading,
    error,
    resetError,

    // Avatar
    avatarFile,
    setAvatarFile,
    uploadingAvatar,
    avatarInputRef,
    avatarPreviewUrl,

    // Profile name
    isEditingProfile,
    setIsEditingProfile,
    newDisplayName,
    setNewDisplayName,

    // Email
    isEditingEmail,
    setIsEditingEmail,
    newEmail,
    setNewEmail,
    emailMessage,
    setEmailMessage,
    emailVerified,

    // Derived display
    displayNameText,
    avatarAlt,

    // Helper
    isCustomAvatar,

    // Callbacks: Email
    handleVerifyEmail,
    handleUpdateEmail,

    // Callbacks: Auth / Profile
    handleSignOut,
    handleUpdateProfile,

    // Callbacks: Avatar
    handleAvatarChange,
    handleRemoveAvatar,
  };
}
