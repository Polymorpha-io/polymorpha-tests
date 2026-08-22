import { useCallback, useEffect, useRef, useState } from "react";
import type { IStellaMessage } from "@/stella/types";
import { StellaMessages } from "./StellaMessages";
import { StellaInput } from "./StellaInput";

const WIDTH_KEY = "stella_panel_width";
const MIN_W = 300;
const MAX_W = 800;

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    if (raw) return Math.max(MIN_W, Math.min(MAX_W, Number(raw)));
  } catch {
    /* */
  }
  return 380;
}

interface Props {
  isOpen: boolean;
  isStreaming: boolean;
  messages: IStellaMessage[];
  input: string;
  streamingContent: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onClear: () => void;
  onExampleClick: (prompt: string) => void;
}

export function StellaPanel({
  isOpen,
  isStreaming,
  messages,
  input,
  streamingContent,
  onInputChange,
  onSend,
  onClose,
  onClear,
  onExampleClick,
}: Props) {
  const [panelWidth, setPanelWidth] = useState(loadWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      onInputChange("");
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = panelRef.current?.offsetWidth ?? 380;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const diff = startX.current - e.clientX;
      const newW = Math.max(MIN_W, Math.min(MAX_W, startW.current + diff));
      setPanelWidth(newW);
    };
    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(WIDTH_KEY, String(panelWidth));
      } catch {
        /* */
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panelWidth]);

  return (
    <>
      <div
        className={`stella-overlay${isOpen ? " stella-overlay--visible" : ""}`}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className={`stella-panel${isOpen ? " stella-panel--open" : ""}`}
        style={{ width: panelWidth }}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Stella AI chat"
      >
        <div className="stella-drag-handle" onMouseDown={handleMouseDown} />
        <div className="stella-header">
          <div className="stella-header-left">
            <span className="stella-header-icon">✦</span>
            <div className="stella-header-titles">
              <h2 className="stella-header-title">Stella AI</h2>
              <span className="stella-header-subtitle">Your data copilot</span>
            </div>
          </div>
          <button
            className="stella-header-close"
            onClick={onClose}
            aria-label="Close Stella AI"
          >
            ✕
          </button>
        </div>

        <div className="stella-body">
          <StellaMessages
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            onExampleClick={onExampleClick}
            onClear={onClear}
          />
        </div>

        <StellaInput
          value={input}
          onChange={onInputChange}
          onSend={onSend}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
      </aside>
    </>
  );
}
