import { create } from "zustand";
import type { IStellaMessage, StellaSession, WorkspaceRef } from "./types";
import { DEFAULT_GROQ_MODEL } from "./types";
import { StellaService } from "./StellaService";
import type { StellaStreamCallbacks } from "./StellaService";
import { useAuthStore } from "@/store/useAuthStore";
import { useDataStore } from "@/store/useDataStore";
import { WorkspaceService } from "@/lib/WorkspaceService";

const STORAGE_KEY = "stella_sessions";

const service = new StellaService();

function loadSessions(): StellaSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: StellaSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    /* non-critical */
  }
}

function deriveColor(_icon: string, gradient?: string): string {
  if (gradient) return gradient;
  return "#6366f1";
}

const DEFAULT_SESSION_TTL = 1000 * 60 * 60 * 24 * 7;

interface StellaStore {
  isOpen: boolean;
  messages: IStellaMessage[];
  streamingContent: string;
  isStreaming: boolean;

  workspaces: WorkspaceRef[];
  currentSessionId: string | null;
  sessions: StellaSession[];
  activeCellId: string | null;
  activeNotebookId: string | null;

  toggle: () => void;
  close: () => void;
  sendMessage: (content: string) => Promise<void>;
  clear: () => void;
  setActiveCell: (cellId: string | null) => void;
  setActiveNotebook: (notebookId: string | null) => void;

  loadWorkspaces: () => void;
  loadSessions: () => void;
  createSession: (workspaceId?: string | null) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

export const useStellaStore = create<StellaStore>((set, get) => ({
  isOpen: false,
  messages: [],
  streamingContent: "",
  isStreaming: false,

  workspaces: [],
  currentSessionId: null,
  sessions: [],
  activeCellId: null,
  activeNotebookId: null,

  toggle: () => {
    const next = !get().isOpen;
    set({ isOpen: next });
    if (next) {
      get().loadWorkspaces();
      get().loadSessions();
    }
  },

  close: () => set({ isOpen: false }),

  setActiveCell: (cellId) => {
    set({ activeCellId: cellId });
    // also push to service for next message
    try {
      const wsId =
        get().sessions.find((s) => s.id === get().currentSessionId)
          ?.workspaceId ?? null;
      // use effective workspace for guest
      const effectiveWs =
        wsId ?? useDataStore.getState().workspaceId ?? "guest";
      service.setContext(effectiveWs, { activeCellId: cellId });
    } catch {}
  },

  setActiveNotebook: (notebookId) => set({ activeNotebookId: notebookId }),

  loadWorkspaces: () => {
    const wsService = tryGetWorkspaceService();
    if (wsService) {
      wsService
        .listWorkspaces()
        .then((wss) => {
          const refs = wss.map((w) => ({
            workspaceId: w.workspaceId,
            name: w.name,
          }));
          set({ workspaces: refs });
        })
        .catch(() => {});
    }
  },

  loadSessions: () => {
    const sessions = loadSessions();
    const expired = sessions.filter(
      (s) => Date.now() - s.updatedAt > DEFAULT_SESSION_TTL,
    );
    if (expired.length > 0) {
      const remaining = sessions.filter(
        (s) => Date.now() - s.updatedAt <= DEFAULT_SESSION_TTL,
      );
      saveSessions(remaining);
      set({ sessions: remaining });
    } else {
      set({ sessions });
    }
  },

  createSession: (workspaceId?: string | null) => {
    const wsId = workspaceId ?? null;
    service.setContext(wsId);
    set({
      messages: [],
      streamingContent: "",
      currentSessionId: null,
    });
  },

  switchSession: (id: string) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) return;
    set({
      currentSessionId: id,
    });
    if (session.workspaceId) {
      service.setContext(session.workspaceId);
    }
    const stored = loadMessages(session.id);
    set({ messages: stored ?? [] });
  },

  deleteSession: (id: string) => {
    const updated = get().sessions.filter((s) => s.id !== id);
    saveSessions(updated);
    set({ sessions: updated });
    try {
      localStorage.removeItem(`stella_msgs_${id}`);
    } catch {
      /* */
    }
    if (get().currentSessionId === id) {
      set({ currentSessionId: null, messages: [] });
    }
  },

  sendMessage: async (content: string) => {
    const state = get();

    let sessionId = state.currentSessionId;
    const isNewSession = !sessionId && state.messages.length === 0;

    if (isNewSession) {
      sessionId = crypto.randomUUID();
      const title =
        content.length > 50 ? content.slice(0, 47) + "..." : content;
      const wsId = state.currentSessionId
        ? (state.sessions.find((s) => s.id === state.currentSessionId)
            ?.workspaceId ?? null)
        : null;
      const newSession: StellaSession = {
        id: sessionId,
        workspaceId: wsId,
        workspaceIcon: "📁",
        workspaceColor: deriveColor("📁"),
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 1,
      };
      const updatedSessions = [newSession, ...state.sessions];
      saveSessions(updatedSessions);
      set({ sessions: updatedSessions, currentSessionId: sessionId });
    }

    {
      const rawWsId = state.currentSessionId
        ? (state.sessions.find((s) => s.id === state.currentSessionId)
            ?.workspaceId ?? null)
        : null;
      const effectiveWsId =
        rawWsId ?? useDataStore.getState().workspaceId ?? "guest";
      service.setContext(effectiveWsId, {
        activeCellId: state.activeCellId,
        notebookId: state.activeNotebookId,
      });
    }

    const userMsg: IStellaMessage = { role: "user", content };
    set((s) => ({
      messages: [...s.messages, userMsg],
      isStreaming: true,
      streamingContent: "",
    }));

    const callbacks: StellaStreamCallbacks = {
      onToken: (token: string) => {
        set((s) => ({ streamingContent: s.streamingContent + token }));
      },
      onDone: (full: string) => {
        const current = get();
        const updatedMessages = [
          ...current.messages,
          { role: "assistant" as const, content: full },
        ];
        set({
          messages: updatedMessages,
          isStreaming: false,
          streamingContent: "",
        });
        if (sessionId) {
          saveMessages(sessionId, updatedMessages);
          const sessions = loadSessions();
          const idx = sessions.findIndex((s) => s.id === sessionId);
          if (idx !== -1) {
            sessions[idx] = {
              ...sessions[idx],
              updatedAt: Date.now(),
              messageCount: sessions[idx].messageCount + 1,
            };
            saveSessions(sessions);
            set({ sessions });
          }
        }
      },
      onError: (err: Error) => {
        set((s) => ({
          messages: [
            ...s.messages,
            {
              role: "assistant" as const,
              content: `Sorry, I encountered an error: ${err.message}`,
            },
          ],
          isStreaming: false,
          streamingContent: "",
        }));
      },
    };

    await service.sendMessage(
      get().messages.slice(0, -1),
      content,
      DEFAULT_GROQ_MODEL,
      callbacks,
    );
  },

  clear: () => {
    const sid = get().currentSessionId;
    set({ messages: [], streamingContent: "" });
    if (sid) {
      try {
        localStorage.removeItem(`stella_msgs_${sid}`);
      } catch {
        /* */
      }
    }
  },
}));

function tryGetWorkspaceService(): WorkspaceService | null {
  const user = useAuthStore.getState().user;
  return user ? new WorkspaceService(user.uid) : null;
}

function loadMessages(sessionId: string): IStellaMessage[] | null {
  try {
    const raw = localStorage.getItem(`stella_msgs_${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMessages(sessionId: string, messages: IStellaMessage[]): void {
  try {
    localStorage.setItem(`stella_msgs_${sessionId}`, JSON.stringify(messages));
  } catch {
    /* non-critical */
  }
}
