import { ArrowLeft, ArrowRight, PanelRight, RefreshCw } from "lucide-react";
import type { AppStep } from "@/types";

type WorkflowPrimaryAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
};

type WorkflowToolbarProps = {
  previousStep: AppStep | null;
  onBack: (step: AppStep) => void;
  onNewFile?: () => void;
  onToggleSidebar?: () => void;
  primaryAction: WorkflowPrimaryAction | null;
};

export default function WorkflowToolbar({
  previousStep,
  onBack,
  onNewFile,
  onToggleSidebar,
  primaryAction,
}: WorkflowToolbarProps) {
  return (
    /* Toolbar */
    <div className="flex items-center justify-between gap-2 flex-wrap py-2.5 mb-3 border-b border-border">
      {/* ToolbarLeft */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* BackButton */}
        {previousStep && (
          <button
            type="button"
            aria-label="Go back to previous step"
            onClick={() => onBack(previousStep)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-9 rounded-lg text-sm font-medium text-fg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        {/* NewFileButton */}
        {onNewFile && (
          <button
            type="button"
            aria-label="Start a new file"
            onClick={onNewFile}
            className="inline-flex items-center sm:gap-1.5 px-2.5 sm:px-3 h-9 rounded-lg text-sm font-medium text-fg border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">New file</span>
          </button>
        )}
      </div>

      {/* ToolbarRight */}
      <div className="flex items-center gap-2">
        {/* SidebarToggleButton */}
        {onToggleSidebar && (
          <button
            type="button"
            aria-label="Toggle column sidebar"
            onClick={onToggleSidebar}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-fg hover:bg-muted transition-colors"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}

        {/* ContinueButton */}
        {primaryAction && (
          <button
            type="button"
            aria-label={primaryAction.label}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || false}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 h-9 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
          >
            {primaryAction.loading ? (
              <span>Processing…</span>
            ) : (
              <>
                <span className="hidden sm:inline">{primaryAction.label}</span>
                <span className="sm:hidden">Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
