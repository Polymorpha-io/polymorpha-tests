import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAutoLoadWorkspaceDatasets } from "@/components/NotebookWorkbench/useLoadWorkspacePointer";
import type { NotebookDatasetRow } from "@/components/NotebookWorkbench/useNotebookDatasets";

function row(over: Partial<NotebookDatasetRow>): NotebookDatasetRow {
  return {
    key: "k",
    uploadId: "u1",
    fileName: "f.csv",
    varName: null,
    rows: 100,
    cols: 5,
    columns: [],
    storageRef: "ref",
    hasStorage: true,
    missing: false,
    inNotebook: false,
    inWorkspace: true,
    loaded: false,
    mergeable: true,
    ...over,
  };
}

function setup(
  load: ReturnType<typeof vi.fn>,
  rows: NotebookDatasetRow[],
  workspaceId: string | null = "ws-1",
) {
  return renderHook(
    (props: { rows: NotebookDatasetRow[]; workspaceId: string | null }) =>
      useAutoLoadWorkspaceDatasets({ load, ...props }),
    { initialProps: { rows, workspaceId } },
  );
}

describe("useAutoLoadWorkspaceDatasets", () => {
  it("auto-loads every not-loaded workspace dataset once, without clicks", async () => {
    const load = vi.fn().mockResolvedValue({ ok: true });
    const rows = [
      row({ key: "a", uploadId: "u-a", fileName: "a.csv" }),
      row({ key: "b", uploadId: "u-b", fileName: "b.csv" }),
    ];
    const { rerender } = setup(load, rows);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load).toHaveBeenCalledWith(
      { uploadId: "u-a", fileName: "a.csv", storageRef: "ref" },
      { silent: true },
    );
    // Idempotent: re-render with the same rows never re-fires.
    rerender({ rows, workspaceId: "ws-1" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("skips loaded, storage-less, missing rows and guest scope", async () => {
    const load = vi.fn().mockResolvedValue({ ok: true });
    const rows = [
      row({
        key: "live",
        uploadId: "u-l",
        fileName: "l.csv",
        loaded: true,
        inNotebook: true,
        varName: "df",
      }),
      row({
        key: "ns",
        uploadId: "u-n",
        fileName: "n.csv",
        hasStorage: false,
        storageRef: "",
      }),
      row({ key: "miss", uploadId: "u-m", fileName: "m.csv", missing: true }),
      row({ key: "ptr", uploadId: "", fileName: "p.csv" }),
    ];
    setup(load, rows);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(0));
    // Guest scope: nothing loads at all.
    setup(load, [row({ key: "a", uploadId: "u-a", fileName: "a.csv" })], null);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(0));
  });

  it("surfaces a batch warning when loads fail (G19 — inline, not silent)", async () => {
    const load = vi.fn().mockResolvedValue({ ok: false, error: "boom" });
    const { result } = setup(load, [
      row({ key: "a", uploadId: "u-a", fileName: "a.csv" }),
    ]);
    await waitFor(() =>
      expect(result.current.autoLoadWarning).toMatch(/could not be opened/),
    );
    expect(result.current.autoLoadWarning).toContain("boom");
  });

  it("re-arms after a workspace switch (per-user isolation, G18)", async () => {
    const load = vi.fn().mockResolvedValue({ ok: true });
    const rows = [row({ key: "a", uploadId: "u-a", fileName: "a.csv" })];
    const { rerender } = setup(load, rows, "ws-1");
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender({ rows, workspaceId: "ws-2" });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
