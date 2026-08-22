import {
  Layout,
  User,
  Shield,
  Settings,
  Palette,
  BarChart3,
  Astroid,
} from "lucide-react";
import type { ProfileSection } from "@/pages/profile-v2/types";
import { PROFILE_SECTIONS } from "@/pages/profile-v2/constants";

interface SidebarItem {
  title: string;
  id: ProfileSection;
  icon: typeof User;
}

const featuresItems: SidebarItem[] = [
  { title: "Workspaces", id: "workspaces", icon: Layout },
  { title: "Stella AI", id: "stellaAI", icon: Astroid },
];

const accountItems: SidebarItem[] = [
  { title: "Profile", id: PROFILE_SECTIONS.profile, icon: User },
  { title: "Usage", id: PROFILE_SECTIONS.usage, icon: BarChart3 },
  { title: "Security", id: PROFILE_SECTIONS.security, icon: Shield },
];

const settingsItems: SidebarItem[] = [
  { title: "Appearance", id: PROFILE_SECTIONS.appearance, icon: Palette },
  { title: "Preferences", id: PROFILE_SECTIONS.preferences, icon: Settings },
];

export const sidebarGroups: { label: string; items: SidebarItem[] }[] = [
  { label: "Features", items: featuresItems },
  { label: "Account", items: accountItems },
  { label: "Settings", items: settingsItems },
];
