import { useShellStore } from "@/store/useShellStore";
import { Button } from "@/components/shadcn/button";
import { Menu } from "lucide-react";

export function SidebarTrigger() {
  const triggerVisible = useShellStore((s) => s.triggerVisible);
  const toggleSidebar = useShellStore((s) => s.toggleSidebar);

  if (!triggerVisible) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      aria-label="Open sidebar"
    >
      <Menu className="rtl:rotate-180" />
    </Button>
  );
}
