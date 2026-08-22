import { Button } from "@/components/shadcn/button";

export function ExportActions({
  formatLabel,
  canGenerate,
  generating,
  phase,
  progress,
  onGenerate,
  onCancel,
  lastFileName,
  canSave,
  onSave,
  saving,
  error,
  fallbackWarning,
}: {
  formatLabel: string;
  canGenerate: boolean;
  generating: boolean;
  phase: string;
  progress: number;
  onGenerate: () => void;
  onCancel: () => void;
  lastFileName: string | null;
  canSave: boolean;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  fallbackWarning: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          aria-live="polite"
        >
          {generating
            ? `${phase || "Generating"} — ${progress}%`
            : `Export ${formatLabel}`}
        </Button>
        {generating ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {lastFileName ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onSave}
            disabled={!canSave || saving}
          >
            {saving ? "Saving…" : "Save to workspace"}
          </Button>
        ) : null}
      </div>
      {fallbackWarning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200">
          {fallbackWarning}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
