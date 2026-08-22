import { create } from "zustand";

type ShellStore = {
  sidebarOpen: boolean;
  triggerVisible: boolean;
  toggleSidebar: () => void;
  setTriggerVisible: (visible: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
};

export const useShellStore = create<ShellStore>((set) => ({
  sidebarOpen: false,
  triggerVisible: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTriggerVisible: (visible) => set({ triggerVisible: visible }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
