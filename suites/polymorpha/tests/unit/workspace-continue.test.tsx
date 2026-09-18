import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WorkspaceSections } from "@/pages/workspace/WorkspaceSections";
import { DataView } from "@/components/DataView/DataView";
import { DatasetPreviewModal } from "@/pages/workspace/DatasetPreviewModal";
import { useWorkspaceData } from "@/pages/workspace/hooks/useWorkspaceData";
import {
  loadPreviewDataset,
  type DatasetPreviewState,
} from "@/pages/workspace/datasetPreview";
import { callParseApi } from "@/lib/stats/api";
import { PREVIEW_MAX_ROWS } from "@/config";
import type { WorkspaceDatasetInfo } from "@/lib/WorkspaceService";
import type { WorkspaceService } from "@/lib/WorkspaceService";
import type { Dataset } from "@/types";

function dsInfo(
  uploadId: string,
  uploadedAt: Date,
  missing = false,
): WorkspaceDatasetInfo {
  return {
    uploadId,
    fileName: `${uploadId}.csv`,
    rowCount: 10,
    colCount: 2,
    uploadedAt,
    storageRef: `users/u1/workspaces/ws1/datasets/${uploadId}/data.csv`,
    hasStorage: true,
    missing,
  };
}

describe("WorkspaceSections (POLY-WS-CONTINUE)", () => {
  it("renders Continue next to + Add Dataset and calls onContinue", () => {
    const onContinue = vi.fn();
    render(
      <WorkspaceSections
        datasets={[dsInfo("a", new Date(0))]}
        onPreviewDataset={() => {}}
        onContinue={onContinue}
        onAddDataset={() => {}}
      />,
    );
    const continueBtn = screen.getByRole("button", {
      name: "Continue",
    }) as HTMLButtonElement;
    expect(screen.getByRole("button", { name: "+ Add Dataset" })).toBeTruthy();
    expect(continueBtn.disabled).toBe(false);
    fireEvent.click(continueBtn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("disables Continue when every dataset is missing", () => {
    render(
      <WorkspaceSections
        datasets={[dsInfo("gone", new Date(0), true)]}
        onPreviewDataset={() => {}}
        onContinue={() => {}}
        onAddDataset={() => {}}
      />,
    );
    const btn = screen.getByRole("button", {
      name: "Continue",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("row click previews instead of entering the pipeline", () => {
    const onPreviewDataset = vi.fn();
    render(
      <WorkspaceSections
        datasets={[dsInfo("a", new Date(0))]}
        onPreviewDataset={onPreviewDataset}
        onContinue={() => {}}
        onAddDataset={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("a.csv"));
    expect(onPreviewDataset).toHaveBeenCalledWith("a");
    expect(onPreviewDataset).toHaveBeenCalledTimes(1);
  });
});

describe("DataView preview semantics", () => {
  it("calls onPreview for an openable row and keeps missing rows inert", () => {
    const onPreview = vi.fn();
    const onRemove = vi.fn();
    render(
      <DataView
        datasets={[dsInfo("a", new Date(0)), dsInfo("gone", new Date(0), true)]}
        onPreview={onPreview}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByText("a.csv"));
    expect(onPreview).toHaveBeenCalledWith("a");
    const missing = screen
      .getByText("Missing upload (deleted)")
      .closest("button") as HTMLButtonElement;
    expect(missing.disabled).toBe(true);
  });
});

describe("DatasetPreviewModal", () => {
  const preview: DatasetPreviewState = {
    fileName: "big.csv",
    dataset: {
      fileName: "big.csv",
      uploadedAt: new Date(0),
      columns: [
        {
          name: "id",
          type: "numeric" as const,
          detectedType: "numeric" as const,
        },
      ],
      rows: [{ id: 1 }],
    },
    totalRows: 4200,
    truncated: true,
  };

  it("renders identity, table and the truncation note for a sliced preview", () => {
    render(<DatasetPreviewModal preview={preview} onClose={() => {}} />);
    expect(
      screen.getByText(/Preview only — showing first 1 of 4,200 rows/),
    ).toBeTruthy();
  });

  it("renders without the truncation note for a full preview", () => {
    render(
      <DatasetPreviewModal
        preview={{ ...preview, truncated: false }}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/Preview only/)).toBeNull();
  });
});

const { cacheGet, cacheSet, fakeLoad, showPipeline, storeState, fakeService } =
  vi.hoisted(() => ({
    cacheGet: vi.fn(),
    cacheSet: vi.fn(async () => {}),
    fakeLoad: vi.fn(),
    showPipeline: vi.fn(),
    storeState: { raw: null as unknown },
    fakeService: {
      getUploadMeta: vi.fn(),
      getWorkspace: vi.fn(async () => null),
    },
  }));

vi.mock("@/lib/stats/api", () => ({ callParseApi: vi.fn() }));
vi.mock("@/lib/CacheService", () => ({
  getCacheService: () => ({ getDataset: cacheGet, setDataset: cacheSet }),
}));
vi.mock("@/lib/WorkspaceService", () => ({
  createWorkspaceService: () => fakeService,
}));
vi.mock("@/hooks/useLoadWorkspaceDataset", () => ({
  useLoadWorkspaceDataset: () => fakeLoad,
}));
vi.mock("@/hooks/useWorkspaceAutosave", () => ({
  useWorkspaceAutosave: () => {},
}));
vi.mock("@/store/useDataStore", () => ({
  useDataStore: { getState: () => storeState },
}));

function previewMeta(hash?: string, rowCount = 4200) {
  return {
    storagePath: `users/u1/x.csv`,
    fileName: "big.csv",
    fileSize: 1,
    rowCount,
    contentHash: hash,
  };
}

describe("loadPreviewDataset", () => {
  beforeEach(() => {
    cacheGet.mockReset();
    cacheSet.mockReset();
    vi.mocked(callParseApi).mockReset();
    vi.mocked(fakeService.getUploadMeta).mockReset();
  });

  it("parses a display-only slice when the cache misses", async () => {
    cacheGet.mockResolvedValue(null);
    vi.mocked(fakeService.getUploadMeta).mockResolvedValue(
      previewMeta("h1") as never,
    );
    vi.mocked(callParseApi).mockResolvedValue({
      headers: ["id"],
      rows: [{ id: 1 }],
      columnTypes: [{ name: "id", type: "numeric", detectedType: "numeric" }],
      rowCount: 4200,
      colCount: 1,
      fileName: "big.csv",
    } as never);
    const out = await loadPreviewDataset(fakeService, "ws1", "u1");
    expect(callParseApi).toHaveBeenCalledWith(
      "users/u1/x.csv",
      PREVIEW_MAX_ROWS,
      undefined,
      "h1",
    );
    expect(out.truncated).toBe(true);
    expect(out.totalRows).toBe(4200);
    // Slice cached under the distinct preview key — never the full key.
    await waitFor(() => {
      expect(cacheSet).toHaveBeenCalledWith(
        `h1:preview${PREVIEW_MAX_ROWS}`,
        out.dataset,
      );
    });
  });

  it("serves a cache hit without a parse round-trip", async () => {
    cacheGet.mockImplementation(async (key: string) =>
      key === "h2"
        ? ({
            fileName: "small.csv",
            columns: [{ name: "id", type: "numeric", detectedType: "numeric" }],
            rows: [{ id: 1 }],
            uploadedAt: new Date(0),
          } as Dataset)
        : null,
    );
    vi.mocked(fakeService.getUploadMeta).mockResolvedValue(
      previewMeta("h2", 1) as never,
    );
    const out = await loadPreviewDataset(fakeService, "ws1", "u2");
    expect(callParseApi).not.toHaveBeenCalled();
    expect(out.truncated).toBe(false);
    expect(out.fileName).toBe("small.csv");
  });

  it("throws when metadata is missing", async () => {
    vi.mocked(fakeService.getUploadMeta).mockResolvedValue(null);
    await expect(
      loadPreviewDataset(fakeService, "ws1", "gone"),
    ).rejects.toThrow(/metadata not found/i);
  });
});

function renderDataHook(datasets: WorkspaceDatasetInfo[]) {
  return renderHook(
    () =>
      useWorkspaceData({
        workspaceId: "ws1",
        user: { uid: "u1" },
        authInitialized: true,
        datasets,
        setDatasets: () => {},
        setError: () => {},
        setShowPipeline: showPipeline,
      }),
    { wrapper: MemoryRouter },
  );
}

describe("useWorkspaceData.handleContinue", () => {
  beforeEach(() => {
    fakeLoad.mockReset();
    showPipeline.mockReset();
    storeState.raw = null;
  });

  it("resumes instantly when the store already holds a frame", async () => {
    storeState.raw = { fileName: "x.csv", rows: [], columns: [] };
    const { result } = renderDataHook([dsInfo("a", new Date(0))]);
    await result.current.handleContinue();
    expect(fakeLoad).not.toHaveBeenCalled();
    expect(showPipeline).toHaveBeenCalledWith(true);
  });

  it("hydrates the most recent non-missing dataset when the store is empty", async () => {
    fakeLoad.mockResolvedValue(undefined);
    const { result } = renderDataHook([
      dsInfo("older", new Date(2026, 0, 1)),
      dsInfo("gone", new Date(2026, 5, 1), true),
      dsInfo("newest", new Date(2026, 8, 1)),
    ]);
    await result.current.handleContinue();
    await waitFor(() => {
      expect(fakeLoad).toHaveBeenCalledWith("newest");
      expect(showPipeline).toHaveBeenCalledWith(true);
    });
  });

  it("does nothing when every dataset is missing", async () => {
    const { result } = renderDataHook([dsInfo("gone", new Date(0), true)]);
    await result.current.handleContinue();
    expect(fakeLoad).not.toHaveBeenCalled();
    expect(showPipeline).not.toHaveBeenCalled();
  });

  it("surfaces load failures instead of opening the pipeline", async () => {
    fakeLoad.mockRejectedValue(new Error("parse failed"));
    const { result } = renderDataHook([dsInfo("a", new Date(0))]);
    await result.current.handleContinue();
    await waitFor(() => {
      expect(showPipeline).not.toHaveBeenCalled();
    });
  });
});
