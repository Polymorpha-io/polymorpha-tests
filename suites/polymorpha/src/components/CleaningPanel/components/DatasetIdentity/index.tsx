import { FileSpreadsheet } from "lucide-react";
import type { DatasetIdentityProps } from "./types";

export function DatasetIdentity({ dataset }: DatasetIdentityProps) {
  return (
    <div className="mb-4 flex flex-nowrap items-center justify-between gap-x-4 min-w-0">
      <span className="flex min-w-0 items-center gap-2 text-lg font-semibold leading-tight font-mono text-foreground">
        <FileSpreadsheet className="h-4 w-4 flex-none text-muted-foreground" />
        <span className="min-w-0">
          <span className="line-clamp-2 wrap-break-word">
            {dataset.fileName}
          </span>
        </span>
      </span>
      <span className="inline-flex items-center shrink-0 overflow-hidden rounded-lg border font-mono text-xs leading-none text-muted-foreground bg-card dark:bg-muted/40 border-border">
        <span className="flex items-center gap-1.5 border-r border-border px-3 py-2">
          {dataset.columns?.length ?? 0} cols
        </span>
        <span className="flex items-center gap-1.5 px-3 py-2">
          {(dataset.rows?.length ?? 0).toLocaleString()} rows
        </span>
      </span>
    </div>
  );
}
