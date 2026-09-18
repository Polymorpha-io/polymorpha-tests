import { describe, expect, it, vi, beforeEach } from "vitest";
import { callStatsApi } from "@/lib/stats/api";
import { recomputeStep } from "@/lib/data-ops";
import type { Row } from "@/types";

vi.mock("@/lib/stats/api", () => ({
  callStatsApi: vi.fn(),
  callStatsApiWithPath: vi.fn(),
}));

const ACTIVE: Row[] = [{ id: 3, v: "active" }];
const CHOSEN_LEFT: Row[] = [
  { id: 1, v: "left" },
  { id: 2, v: "left" },
];
const ACTIVE_COLUMNS = [
  { name: "id", type: "numeric" as const, detectedType: "numeric" as const },
];

beforeEach(() => {
  vi.mocked(callStatsApi).mockReset();
  vi.mocked(callStatsApi).mockResolvedValue({
    rows: [{ id: 1 }],
    columns: ACTIVE_COLUMNS,
    rowCount: 1,
    totalRowCount: 1,
  });
});

/** POLY-NB-OPERANDS: the combine executor ships whichever side the op
 *  recorded as `leftRows` — the active frame only when no left operand was
 *  chosen (legacy configs unchanged). */
describe("combine operand order (executor)", () => {
  it("ships the recorded left rows as leftRows for a swapped merge", async () => {
    await recomputeStep(
      {
        fileName: "df.csv",
        uploadedAt: new Date(0),
        columns: ACTIVE_COLUMNS,
        rows: ACTIVE,
      } as never,
      {
        type: "merge",
        source: { type: "workspace" },
        joinType: "left",
        leftKey: "id",
        rightKey: "id",
        behavior: "expand",
        how: "left",
        leftDatasetName: "out",
        leftVarName: "out",
        leftRows: CHOSEN_LEFT,
        rightDatasetName: "df.csv",
        rightRows: ACTIVE,
      } as never,
    );
    const params = vi.mocked(callStatsApi).mock.calls[0][2] as Record<
      string,
      unknown
    >;
    expect(params["leftRows"]).toEqual(CHOSEN_LEFT);
    expect(params["rightRows"]).toEqual(ACTIVE);
  });

  it("keeps the active frame as leftRows for legacy configs (backward compat)", async () => {
    await recomputeStep(
      {
        fileName: "df.csv",
        uploadedAt: new Date(0),
        columns: ACTIVE_COLUMNS,
        rows: ACTIVE,
      } as never,
      {
        type: "merge",
        source: { type: "workspace" },
        joinType: "inner",
        leftKey: "id",
        rightKey: "id",
        behavior: "expand",
        how: "inner",
        rightDatasetName: "x.csv",
        rightRows: CHOSEN_LEFT,
      } as never,
    );
    const params = vi.mocked(callStatsApi).mock.calls[0][2] as Record<
      string,
      unknown
    >;
    expect(params["leftRows"]).toEqual(ACTIVE);
    expect(params["rightRows"]).toEqual(CHOSEN_LEFT);
  });

  it("stacks recorded left rows first for concat", async () => {
    await recomputeStep(
      {
        fileName: "df.csv",
        uploadedAt: new Date(0),
        columns: ACTIVE_COLUMNS,
        rows: ACTIVE,
      } as never,
      {
        type: "concat",
        axis: 0,
        leftDatasetName: "a.csv",
        leftRows: CHOSEN_LEFT,
        rightDatasetName: "df.csv",
        rightRows: ACTIVE,
      } as never,
    );
    const params = vi.mocked(callStatsApi).mock.calls[0][2] as Record<
      string,
      unknown
    >;
    expect(params["frames"]).toEqual([CHOSEN_LEFT, ACTIVE]);
  });
});
