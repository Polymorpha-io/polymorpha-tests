import { useEffect } from "react";
import { useShellStore } from "@/store/useShellStore";

// Module-level counter survives across mounts. Survives Strict Mode
// double-invocation in dev because every bump is matched by a cleanup.
let triggerRegistrations = 0;

export function useSidebarTrigger(visible: boolean) {
  const setTriggerVisible = useShellStore((s) => s.setTriggerVisible);
  const setSidebarOpen = useShellStore((s) => s.setSidebarOpen);

  useEffect(() => {
    if (!visible) return;

    triggerRegistrations += 1;
    const shouldShowTrigger = triggerRegistrations === 1;

    if (shouldShowTrigger) {
      setTriggerVisible(true);
    }

    return () => {
      triggerRegistrations -= 1;
      const shouldHideTrigger = triggerRegistrations === 0;

      if (!shouldHideTrigger) return;

      setTriggerVisible(false);
      if (useShellStore.getState().sidebarOpen) {
        setSidebarOpen(false);
      }
    };
  }, [visible, setTriggerVisible, setSidebarOpen]);
}
