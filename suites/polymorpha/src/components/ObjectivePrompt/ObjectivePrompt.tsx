import { useEffect, useRef, useState } from "react";
import { useDataStore } from "@/store/useDataStore";
import "./ObjectivePrompt.css";

export function ObjectivePrompt() {
  const raw = useDataStore((s) => s.raw);
  const rawHash = useDataStore((s) => s.rawHash);
  const step = useDataStore((s) => s.step);
  const objective = useDataStore((s) => s.objective);
  const setObjective = useDataStore((s) => s.setObjective);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hadPromptedRef = useRef<string | null>(null);

  // Show inbox once after Data Modeller — on first entry to preview
  useEffect(() => {
    if (
      step === "preview" &&
      raw &&
      objective === null &&
      rawHash &&
      hadPromptedRef.current !== rawHash
    ) {
      const t = setTimeout(() => {
        setOpen(true);
        hadPromptedRef.current = rawHash;
      }, 400);
      return () => clearTimeout(t);
    }
    if (!raw || objective !== null || step !== "preview") {
      if (objective !== null) setOpen(false);
      if (!raw) {
        hadPromptedRef.current = null;
        setOpen(false);
      }
      if (step !== "preview" && open) {
        // keep open if already opened, but don't reopen
      }
    }
  }, [step, raw, rawHash, objective, open]);

  // Sync value when opening + focus
  useEffect(() => {
    if (open) {
      setValue(objective ?? "");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, objective]);

  // ESC to close, focus trap minimal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    const v = value.trim();
    if (!v) return;
    setObjective(v);
    setOpen(false);
  };

  const handleSkip = () => {
    // Keep as null but don't reprompt immediately — close and user can edit later via header
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
  };

  return (
    <div className="objective-overlay" role="presentation" onClick={handleSkip}>
      <div
        ref={dialogRef}
        className="objective-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Set your objective"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="objective-header">
          <h2 className="objective-title">What’s your objective?</h2>
          <p className="objective-subtitle">
            e.g. “find winners”, “predict churn”, “compare groups”. This helps
            Stella and Recommend tailor to your goal.
          </p>
        </div>

        <textarea
          ref={inputRef}
          className="objective-input"
          placeholder="Type your objective here..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          autoFocus
        />

        <div className="objective-actions">
          <button type="button" className="btn-ghost" onClick={handleSkip}>
            Skip
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={!value.trim()}
          >
            Save objective
          </button>
        </div>
        <p className="objective-hint">
          You can edit this later from the header. Press ⌘/Ctrl+Enter to save.
        </p>
      </div>
    </div>
  );
}
