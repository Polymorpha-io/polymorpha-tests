import { useEffect } from "react";
import { useSidebar } from "@/components/shadcn/sidebar";
import { useShellStore } from "@/store/useShellStore";

export function SidebarBridge() {
  const { openMobile, setOpenMobile } = useSidebar();
  const sidebarOpen = useShellStore((s) => s.sidebarOpen);

  useEffect(() => {
    setOpenMobile(sidebarOpen);
  }, [sidebarOpen, setOpenMobile]);

  useEffect(() => {
    useShellStore.setState({ sidebarOpen: openMobile });
  }, [openMobile]);

  return null;
}
