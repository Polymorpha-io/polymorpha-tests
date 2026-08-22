import { useShallow } from "zustand/react/shallow";
import { useDataStore } from "@/store/useDataStore";
import { RecommendButton } from "@/components/RecommendButton/RecommendButton";
import SchemaSidebar from "@/components/DataPreview/components/SchemaSidebar";
import DataTable from "@/components/DataPreview/components/DataTable";

interface DataPreviewProps {
  showSidebar?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
}

export function DataPreview({
  showSidebar,
  onSidebarOpenChange,
}: DataPreviewProps) {
  const { raw, preview } = useDataStore(
    useShallow((s) => ({ raw: s.raw, preview: s.preview })),
  );

  // Preview is 100 rows for paint; raw is full file for pipeline.
  const viewDataset = preview ?? raw ?? { columns: [], rows: [], fileName: "" };
  const { columns, fileName } = viewDataset;
  const previewRows = viewDataset.rows;
  const fullRowCount = raw?.rows.length ?? previewRows.length;

  if (!viewDataset || (!raw && !preview)) {
    return null;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-card border border-border rounded-lg h-screen">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/50">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Preview
        </span>
        <RecommendButton stage="preview" />
      </div>
      <div className="flex flex-1 min-h-0 relative">
        <SchemaSidebar
          fileName={fileName}
          rowCount={fullRowCount}
          columns={columns}
          open={showSidebar}
          onOpenChange={onSidebarOpenChange}
        />
        <DataTable
          columns={columns}
          rows={previewRows}
          totalRowCount={fullRowCount}
        />
      </div>
    </div>
  );
}
