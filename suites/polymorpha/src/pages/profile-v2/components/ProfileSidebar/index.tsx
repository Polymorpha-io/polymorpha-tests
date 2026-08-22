import { Fragment, useCallback } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/shadcn/sidebar";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { PROFILE_SECTIONS } from "@/pages/profile-v2/constants";
import { sidebarGroups } from "./constants";
import type { ProfileSection } from "@/pages/profile-v2/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useSidebarTrigger } from "@/hooks/useSidebarTrigger";

interface ProfileSidebarProps {
  activeSection: ProfileSection;
  onSectionChange: (section: ProfileSection) => void;
}

export function ProfileSidebar({
  activeSection,
  onSectionChange,
}: ProfileSidebarProps) {
  const { toggleSidebar, open, state, isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuthStore();
  useSidebarTrigger(isMobile);

  const handleItemClick = useCallback(
    (section: ProfileSection) => {
      onSectionChange(section);
      if (isMobile) {
        setOpenMobile(false);
      }
    },
    [onSectionChange, isMobile, setOpenMobile],
  );

  const renderTrigger = useCallback(
    () =>
      !isMobile ? (
        <div
          className={
            open
              ? "flex items-center justify-end pt-2"
              : "flex items-center justify-center"
          }
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  data-sidebar="trigger"
                  data-slot="sidebar-trigger"
                  variant="ghost"
                  onClick={toggleSidebar}
                >
                  {open ? <PanelLeftClose /> : <PanelLeftOpen />}
                  <span className="sr-only">Toggle Sidebar</span>
                </Button>
              }
            />
            <TooltipContent
              side="right"
              align="center"
              hidden={state === "expanded" || isMobile}
            >
              Expand Sidebar
            </TooltipContent>
          </Tooltip>
        </div>
      ) : null,
    [open, state, isMobile, toggleSidebar],
  );

  const renderGroups = useCallback(
    () =>
      sidebarGroups.map(({ label, items }, index) => (
        <Fragment key={label}>
          {index > 0 && <SidebarSeparator />}
          <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item.id)}
                      isActive={activeSection === item.id}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </Fragment>
      )),
    [activeSection, handleItemClick],
  );

  return (
    <Sidebar collapsible="icon" className="absolute top-0 bottom-0 h-auto">
      {renderTrigger()}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-auto py-2 items-start"
              onClick={() => handleItemClick(PROFILE_SECTIONS.profile)}
              isActive={activeSection === PROFILE_SECTIONS.profile}
            >
              <Avatar className="size-8 border border-border mt-0.5">
                <AvatarImage
                  src={user?.photoURL ?? undefined}
                  alt={user?.displayName ?? user?.email ?? "User avatar"}
                />
                <AvatarFallback className="text-xs font-semibold">
                  {(user?.displayName ?? user?.email ?? "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 leading-none min-w-0 pr-2">
                <span
                  className="font-semibold line-clamp-3"
                  title={user?.displayName || user?.email || "Account"}
                >
                  {user?.displayName || user?.email || "Account"}
                </span>
                <span
                  className="text-xs text-sidebar-foreground/60 line-clamp-3"
                  title={user?.email || ""}
                >
                  {user?.email || ""}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>{renderGroups()}</SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
