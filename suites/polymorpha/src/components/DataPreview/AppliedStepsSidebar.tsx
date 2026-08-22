import { useDataStore } from "@/store/useDataStore";
import { useShallow } from "zustand/react/shallow";
import {
  Trash2,
  Settings2,
  DatabaseZap,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { DataOperationStep } from "@/types";

// Individual step component
function AppliedStepItem({
  step,
  index,
  totalSteps,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: DataOperationStep;
  index: number;
  totalSteps: number;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}) {
  return (
    <div className="applied-step-item">
      <div className="applied-step-drag-handle" style={{ cursor: "default" }}>
        <span style={{ fontSize: "12px", fontWeight: "bold" }}>
          {index + 1}
        </span>
      </div>
      <div className="applied-step-content">
        <span className="applied-step-title">{step.description}</span>
        <span className="applied-step-type">{step.config.type}</span>
      </div>
      <div className="applied-step-actions" style={{ gap: "4px" }}>
        <button
          className="btn-icon"
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          title="Move up"
          style={{ opacity: index === 0 ? 0.3 : 1 }}
        >
          <ArrowUp size={14} />
        </button>
        <button
          className="btn-icon"
          onClick={() => onMoveDown(index)}
          disabled={index === totalSteps - 1}
          title="Move down"
          style={{ opacity: index === totalSteps - 1 ? 0.3 : 1 }}
        >
          <ArrowDown size={14} />
        </button>
        <button
          className="btn-icon"
          onClick={() => onRemove(step.id)}
          title="Delete step"
          style={{ color: "var(--destructive, #ef4444)", marginLeft: "4px" }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function AppliedStepsSidebar() {
  const { appliedSteps, removeAppliedStep, reorderAppliedSteps } = useDataStore(
    useShallow((s) => ({
      appliedSteps: s.appliedSteps,
      removeAppliedStep: s.removeAppliedStep,
      reorderAppliedSteps: s.reorderAppliedSteps,
    })),
  );

  function handleMoveUp(index: number) {
    if (index > 0) {
      reorderAppliedSteps(index, index - 1);
    }
  }

  function handleMoveDown(index: number) {
    if (index < appliedSteps.length - 1) {
      reorderAppliedSteps(index, index + 1);
    }
  }

  function handleRemove(id: string) {
    // In a full implementation, warn if downstream steps depend on this.
    const confirm = window.confirm(
      "Delete this step? Downstream steps that rely on this step's output may fail.",
    );
    if (confirm) {
      removeAppliedStep(id);
    }
  }

  return (
    <aside className="preview-applied-steps-sidebar" aria-label="Applied Steps">
      <div className="applied-steps-header">
        <Settings2 size={18} />
        <h2>Applied Steps</h2>
      </div>

      <div className="applied-steps-list-container">
        {appliedSteps.length === 0 ? (
          <div className="applied-steps-empty">
            <DatabaseZap
              size={32}
              opacity={0.5}
              style={{ marginBottom: "12px" }}
            />
            <p>No steps applied yet.</p>
            <span className="text-muted" style={{ marginTop: "8px" }}>
              Use the Data Operations toolbar to prepare your data.
            </span>
          </div>
        ) : (
          <div className="applied-steps-list">
            {appliedSteps.map((step, index) => (
              <AppliedStepItem
                key={step.id}
                step={step}
                index={index}
                totalSteps={appliedSteps.length}
                onRemove={handleRemove}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            ))}
          </div>
        )}
      </div>

      <div className="applied-steps-footer">
        <button
          className="btn-primary w-full"
          disabled={appliedSteps.length === 0}
          onClick={() => alert("Commit flow to be implemented...")}
        >
          Commit Changes
        </button>
      </div>
    </aside>
  );
}
