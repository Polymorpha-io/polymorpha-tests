import { describe, expect, it, beforeEach } from "vitest";
import { exportStorageExt } from "@/features/export/lib/sanitize";
import { useReportStore } from "@/features/export/store/useReportStore";
import {
  REPORT_DRAFT_MAX_CHARS,
  migrateState,
} from "@/lib/workspace";

describe("exportStorageExt", () => {
  it("maps legacy and studio types to storage extensions", () => {
    expect(exportStorageExt("premium-pdf")).toBe("pdf");
    expect(exportStorageExt("statistical-pdf")).toBe("pdf");
    expect(exportStorageExt("excel")).toBe("xlsx");
    expect(exportStorageExt("csv")).toBe("csv");
    expect(exportStorageExt("docx")).toBe("docx");
    expect(exportStorageExt("markdown")).toBe("md");
    expect(exportStorageExt("latex")).toBe("tex");
  });

  it("throws on unknown types instead of mislabeling the artifact", () => {
    expect(() => exportStorageExt("mystery")).toThrow(/Unknown export type/);
  });
});

describe("useReportStore persistence", () => {
  beforeEach(() => {
    useReportStore.setState({
      markdown: "",
      datasetKey: "",
      originPreset: "standard",
      version: 0,
      dirty: false,
      stale: false,
    });
  });

  it("round-trips a draft through snapshot", () => {
    useReportStore.getState().initDoc("# Hello", "demo.csv__2x2", "standard");
    expect(useReportStore.getState().snapshotReport()).toEqual({
      markdown: "# Hello",
      datasetKey: "demo.csv__2x2",
    });
  });

  it("hydrateReport restores an empty store", () => {
    useReportStore.getState().hydrateReport("# saved", "demo.csv__2x2");
    expect(useReportStore.getState().markdown).toBe("# saved");
    expect(useReportStore.getState().dirty).toBe(false);
  });

  it("hydrateReport preserves live edits to the same document", () => {
    useReportStore.getState().hydrateReport("# saved", "demo.csv__2x2");
    useReportStore.getState().setMarkdown("# my edits");
    useReportStore.getState().hydrateReport("# stale remote", "demo.csv__2x2");
    expect(useReportStore.getState().markdown).toBe("# my edits");
    expect(useReportStore.getState().datasetKey).toBe("demo.csv__2x2");
  });

  it("hydrateReport replaces the draft when the workspace changes", () => {
    useReportStore.getState().hydrateReport("# ws-a", "a.csv__2x2");
    useReportStore.getState().setMarkdown("# ws-a edits");
    // Opening workspace B: persisted truth wins despite in-memory edits,
    // otherwise B would reseed from template and lose its stored draft.
    useReportStore.getState().hydrateReport("# ws-b draft", "b.csv__3x4");
    expect(useReportStore.getState().markdown).toBe("# ws-b draft");
    expect(useReportStore.getState().datasetKey).toBe("b.csv__3x4");
    expect(useReportStore.getState().dirty).toBe(false);
  });

  it("hydrateReport beats a pristine template seed (loader lands late)", () => {
    useReportStore.getState().initDoc("# template", "b.csv__3x4", "standard");
    expect(useReportStore.getState().dirty).toBe(false);
    useReportStore.getState().hydrateReport("# ws-b draft", "b.csv__3x4");
    expect(useReportStore.getState().markdown).toBe("# ws-b draft");
  });

  it("hydrateReport adopts an explicitly cleared draft on fresh loads", () => {
    // Persisted "" with a key claims the doc so the studio does not
    // reseed a template over it.
    useReportStore.getState().hydrateReport("", "b.csv__3x4");
    expect(useReportStore.getState().markdown).toBe("");
    expect(useReportStore.getState().datasetKey).toBe("b.csv__3x4");
  });

  it("hydrateReport clears a claimed clean doc", () => {
    useReportStore.getState().hydrateReport("# draft", "b.csv__3x4");
    useReportStore.getState().hydrateReport("", "b.csv__3x4");
    expect(useReportStore.getState().markdown).toBe("");
  });

  it("hydrateReport ignores empty drafts for other workspaces", () => {
    useReportStore.getState().hydrateReport("# ws-a", "a.csv__2x2");
    useReportStore.getState().hydrateReport("", "b.csv__3x4");
    expect(useReportStore.getState().markdown).toBe("# ws-a");
    expect(useReportStore.getState().datasetKey).toBe("a.csv__2x2");
  });

  it("exposes a sane draft cap", () => {
    expect(REPORT_DRAFT_MAX_CHARS).toBeGreaterThan(100_000);
  });
});

describe("workspace state report passthrough", () => {
  it("keeps optional report fields on a v3 blob (no migration loss)", () => {
    const blob = {
      version: 3,
      exportState: {
        format: "pdf",
        reportMarkdown: "# Draft",
        reportDatasetKey: "demo.csv__2x2",
        reportUpdatedAt: "2026-09-13T00:00:00.000Z",
      },
    };
    const migrated = migrateState(blob);
    expect(migrated.exportState?.reportMarkdown).toBe("# Draft");
    expect(migrated.exportState?.reportDatasetKey).toBe("demo.csv__2x2");
    expect(migrated.exportState?.reportUpdatedAt).toBe(
      "2026-09-13T00:00:00.000Z",
    );
  });

  it("older blobs migrate without report fields (undefined, not crash)", () => {
    const migrated = migrateState({ version: 0, workspaceId: "w1" });
    expect(migrated.version).toBe(3);
    expect(migrated.exportState?.reportMarkdown).toBeUndefined();
  });
});
