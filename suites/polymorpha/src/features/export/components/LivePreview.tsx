import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shadcn/tabs";
import type { PreviewTable } from "../types";

export function LivePreview({
  format,
  pdfDataUrl,
  pdfLoading,
  pdfError,
  cleanedRowCount,
  totalRowCount,
  previewTables,
  generationInProgress,
  generationPhase,
  generationProgress,
}: {
  format: "pdf" | "xlsx" | "csv";
  pdfDataUrl: string | null;
  pdfLoading: boolean;
  pdfError: string | null;
  cleanedRowCount: number;
  totalRowCount: number;
  previewTables: Record<string, PreviewTable>;
  generationInProgress: boolean;
  generationPhase: string;
  generationProgress: number;
}) {
  const wasFallback = totalRowCount > 0 && cleanedRowCount !== totalRowCount;
  return (
    <Card className="flex min-h-[540px] flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Preview: {format.toUpperCase()}{" "}
          <span className="font-normal text-muted-foreground">
            — {cleanedRowCount.toLocaleString()} of{" "}
            {totalRowCount.toLocaleString()} rows
            {wasFallback ? " · fallback" : ""}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {format === "pdf"
            ? "PDF preview is the generated document (iframe). Stale preview shown while rebuilding."
            : "Tabular preview — 20 rows shown. Full data exported."}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {format === "pdf" ? (
          <div
            className="relative flex flex-1 flex-col overflow-hidden rounded-md border bg-white"
            role="region"
            aria-live="polite"
            aria-label="PDF preview"
          >
            {pdfLoading ? (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                Building PDF preview…
              </div>
            ) : pdfError ? (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
                Preview failed: {pdfError}
              </div>
            ) : pdfDataUrl ? (
              <iframe
                title="PDF preview"
                src={pdfDataUrl}
                className="h-[680px] w-full border-0"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                No preview yet — configure and generate.
              </div>
            )}
            {generationInProgress ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm">
                  {generationPhase || "Generating…"}
                </span>
                <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, generationProgress))}%`,
                    }}
                    role="progressbar"
                    aria-valuenow={generationProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {generationProgress}%
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <Tabs defaultValue="cleaned" className="flex flex-1 flex-col">
            <TabsList>
              <TabsTrigger value="cleaned" className="flex-1">
                Cleaned
              </TabsTrigger>
              {format === "xlsx" ? (
                <>
                  <TabsTrigger value="descriptive" className="flex-1">
                    Descriptive
                  </TabsTrigger>
                  <TabsTrigger value="tests" className="flex-1">
                    Tests
                  </TabsTrigger>
                </>
              ) : null}
            </TabsList>
            {Object.entries(previewTables).map(([key, table]) => (
              <TabsContent
                key={key}
                value={key}
                className="flex flex-1 flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        {table.columns.map((c) => (
                          <th
                            key={c.name}
                            className="px-2 py-1.5 text-left font-medium"
                          >
                            <span title={c.name} className="truncate">
                              {c.name}
                            </span>
                            {c.type ? (
                              <span className="ml-1 rounded bg-muted-foreground/10 px-1 py-0.5 text-[10px]">
                                {c.type}
                              </span>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t odd:bg-muted/20">
                          {table.columns.map((c) => (
                            <td
                              key={c.name}
                              className="max-w-[160px] truncate px-2 py-1"
                              title={String(row[c.name] ?? "N/A")}
                            >
                              {String(row[c.name] ?? "N/A")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {table.rows.length > 20 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Showing 20 of {table.rows.length.toLocaleString()} rows
                  </p>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
