import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/components/shadcn/sidebar";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { AppearanceSection } from "@/pages/profile-v2/components/AppearanceSection";
import { ComingSoon } from "@/pages/profile-v2/components/ComingSoon";
import { SecuritySection } from "@/pages/profile-v2/components/SecuritySection";
import { ProfileCard } from "@/pages/profile-v2/components/ProfileCard";
import UsageCard from "@/pages/profile-v2/components/UsageCard";
import { ProfileSidebar } from "@/pages/profile-v2/components/ProfileSidebar";
import { SkeletonPage } from "@/pages/profile-v2/components/SkeletonPage";
import { SidebarBridge } from "@/components/renderless/SidebarBridge";
import type { ProfileSection } from "@/pages/profile-v2/types";
import { PROFILE_SECTIONS, sectionContent } from "@/pages/profile-v2/constants";
import { useAuthStore } from "@/store/useAuthStore";
import { useUsageStats } from "@/pages/profile-v2/hooks/useUsageStats";
import { usePreferences } from "@/pages/profile-v2/hooks/usePreferences";
import { useStellaStore } from "@/stella";
import { toast } from "sonner"; // dont remove this
void toast;
import {
  BarChart3,
  Palette,
  Settings,
  Shield,
  User,
  Astroid,
  Layout,
  type LucideIcon,
} from "lucide-react";
import "./styles.css";

const sectionIcons: Record<ProfileSection, LucideIcon> = {
  profile: User,
  usage: BarChart3,
  appearance: Palette,
  security: Shield,
  preferences: Settings,
  workspaces: Layout,
  stellaAI: Astroid,
};

function SectionHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-2xl bg-primary/10 dark:bg-primary flex items-center justify-center text-primary dark:text-primary-foreground shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

export function ProfilePageV2() {
  const [activeSection, setActiveSection] = useState<ProfileSection>("profile");

  const navigate = useNavigate();
  const { toggle: toggleStellaAI } = useStellaStore();

  const handleSectionChange = useCallback(
    (section: ProfileSection) => {
      switch (section) {
        case PROFILE_SECTIONS.workspaces:
          navigate("/workspaces");
          return;
        case PROFILE_SECTIONS.stellaAI:
          toggleStellaAI();
          return;
        default:
          setActiveSection(section);
      }
    },
    [navigate, toggleStellaAI],
  );

  const { title, description } = sectionContent[activeSection];
  const renderSection = useCallback(() => {
    switch (activeSection) {
      case PROFILE_SECTIONS.profile:
        return <ProfileCard />;
      case PROFILE_SECTIONS.appearance:
        return <AppearanceSection />;
      case PROFILE_SECTIONS.usage:
        return <UsageCard />;
      case PROFILE_SECTIONS.security:
        return <SecuritySection />;
      case PROFILE_SECTIONS.preferences:
        return <ComingSoon />;
      default:
        return null;
    }
  }, [activeSection]);

  const { refresh: refreshUsageStats } = useUsageStats();
  const { refresh: refreshPreferences } = usePreferences();
  const usageFetchedRef = useRef(false);
  const prefsFetchedRef = useRef(false);
  useEffect(() => {
    switch (activeSection) {
      case PROFILE_SECTIONS.usage: {
        if (usageFetchedRef.current) {
          return;
        }

        usageFetchedRef.current = true;
        refreshUsageStats();
        // toast("Usage stats loaded");
        break;
      }
      // case PROFILE_SECTIONS.preferences:
      case PROFILE_SECTIONS.appearance: {
        if (prefsFetchedRef.current) {
          return;
        }

        prefsFetchedRef.current = true;
        refreshPreferences();
        // toast("Preferences loaded");
        break;
      }
    }
  }, [activeSection, refreshUsageStats, refreshPreferences]);

  const { user, initialized: authInitialized } = useAuthStore();
  useEffect(() => {
    if (authInitialized && !user) {
      sessionStorage.setItem(
        "polymorpha-redirect",
        location.pathname + location.search,
      );
      navigate("/login", { replace: true });
    }
  }, [authInitialized, user, navigate]);

  if (!authInitialized || !user) {
    return <SkeletonPage />;
  }

  return (
    <div className="contents">
      <TooltipProvider>
        <SidebarProvider className="min-h-0 flex-1">
          <SidebarBridge />
          <ProfileSidebar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
          />
          <SidebarInset>
            <main className="flex flex-1 flex-col gap-4 p-6">
              <SectionHeader
                title={title}
                description={description}
                icon={sectionIcons[activeSection]}
              />
              {renderSection()}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
