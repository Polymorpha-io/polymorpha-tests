import type { ProfileSection } from "./types";

export const PROFILE_SECTIONS = {
  workspaces: "workspaces",
  stellaAI: "stellaAI",
  profile: "profile",
  usage: "usage",
  security: "security",
  preferences: "preferences",
  appearance: "appearance",
} as const;

export const sectionContent: Record<
  ProfileSection,
  { title: string; description: string }
> = {
  workspaces: { title: "", description: "" },
  stellaAI: { title: "", description: "" },
  profile: {
    title: "Profile",
    description: "Manage your account profile information.",
  },
  usage: { title: "Usage", description: "Your activity and storage usage." },
  security: {
    title: "Security",
    description: "Manage your password and account security.",
  },
  preferences: {
    title: "Preferences",
    description: "Customize your data and formatting defaults.",
  },
  appearance: {
    title: "Appearance",
    description: "Set the visual style of the app.",
  },
};
