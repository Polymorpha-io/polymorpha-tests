/**
 * Generated API matrix suite — every `STATS_ACTIONS` action through
 * `callStatsApi` (min-rows validation + output validation), plus the
 * storage-backed / parse / clean / execute endpoints, gzip decoding and
 * the 401 token-refresh retry path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { gzipSync, strToU8 } from "fflate";

const storageMocks = vi.hoisted(() => ({
  downloadUrl: "https://mock-download-url/stats.csv",
  getDownloadURL: vi
    .fn()
    .mockResolvedValue("https://mock-download-url/stats.csv"),
  ref: vi.fn(() => ({ mock: true })),
}));

vi.mock("@/config/firebase", () => ({
  getFirebaseAuth: () => ({
    currentUser: {
      getIdToken: (force?: boolean) =>
        Promise.resolve(`token-${force ? "fresh" : "cached"}`),
    },
  }),
  getFirebaseStorage: () => ({ mock: true }),
}));

vi.mock("firebase/storage", () => ({
  ref: storageMocks.ref,
  getDownloadURL: storageMocks.getDownloadURL,
}));

import {
  STATS_ACTIONS,
  callStatsApi,
  callStatsApiWithPath,
  callParseApi,
  callCleanApi,
  callExecuteApi,
} from "@/lib/stats/api";
import {
  makeDataset,
  mockFetch,
  resultForAction,
  paramsForAction,
} from "../../generators";

// Mixed dataset so categorical-dependent actions (frequency, anova, ...) work.
const dataset = makeDataset({
  fileName: "api.csv",
  rows: 20,
  cols: [
    { name: "num_1", type: "numeric" },
    { name: "num_2", type: "numeric" },
    { name: "group", type: "categorical", cardinality: 3 },
    { name: "flag", type: "boolean" },
  ],
  seed: "api",
});
const ROWS = dataset.rows;

describe("callStatsApi — minRows validation for every action", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  it.each(
    Object.entries(STATS_ACTIONS)
      .filter(([, meta]) => meta.minRows > 0)
      .map(([action, meta]) => ({
        label: `${action} — rejects ${meta.minRows - 1} rows (min ${meta.minRows})`,
        action,
      })),
  )("$label", async ({ action }) => {
    const meta = STATS_ACTIONS[action as keyof typeof STATS_ACTIONS];
    const rows = ROWS.slice(0, meta.minRows - 1);
    const params = paramsForAction(action, dataset);
    return expect(callStatsApi(action, rows, params)).rejects.toThrow(
      /requires at least/,
    );
  });

  it.each(
    Object.entries(STATS_ACTIONS)
      .filter(([, meta]) => meta.minRows > 0)
      .map(([action]) => ({
        label: `${action} — resolves with a validated result`,
        action,
      })),
  )("$label", async ({ action }) => {
    mockFetch(resultForAction(action, ["num_1", "num_2"]));
    const params = paramsForAction(action, dataset);
    const result = await callStatsApi(action, ROWS, params);
    expect(result).toBeDefined();
  });
});

describe("callStatsApi — output validation failures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("rejects out-of-range p-values", async () => {
    mockFetch({ column: "num_1", mean: 5, std: 1, pValue: 1.5 });
    await expect(
      callStatsApi("descriptive", ROWS, { column: "num_1" }),
    ).rejects.toThrow(/p-value out of range/);
  });

  it("rejects malformed correlation matrices", async () => {
    mockFetch({ columns: ["num_1", "num_2"], values: [[1, 0.5]] });
    await expect(
      callStatsApi("correlation", ROWS, { columns: ["num_1", "num_2"] }),
    ).rejects.toThrow(/matrix shape mismatch/);
  });

  it("rejects empty results", async () => {
    mockFetch(null);
    await expect(
      callStatsApi("descriptive", ROWS, { column: "num_1" }),
    ).rejects.toThrow(/empty result/);
  });

  it("throws sanitized HTTP errors from the backend", async () => {
    mockFetch(
      { error: "Value error, Unsupported action 'tostMean'" },
      { status: 500 },
    );
    await expect(
      callStatsApi("descriptive", ROWS, { column: "num_1" }),
    ).rejects.toThrow(/Request failed|error/i);
  });
});

describe("callStatsApi — 401 token refresh", () => {
  it("retries once with a force-refreshed token on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { column: "num_1", mean: 5, std: 1 } }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock;
    const result = await callStatsApi("descriptive", ROWS, { column: "num_1" });
    expect(result).toEqual({ column: "num_1", mean: 5, std: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse((init as RequestInit).body as string),
    );
    expect(bodies[1]!.rows).toBeDefined();
  });
});

describe("callStatsApiWithPath", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("sends storagePath + downloadUrl + cleaningConfig and validates output", async () => {
    mockFetch(resultForAction("descriptive"));
    const cleaningConfig = { removeColumns: [] };
    const result = await callStatsApiWithPath(
      "descriptive",
      "users/u/datasets/d.csv",
      cleaningConfig,
      { column: "num_1" },
    );
    expect(result).toBeDefined();
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.action).toBe("descriptive");
    expect(body.storagePath).toBe("users/u/datasets/d.csv");
    expect(body.downloadUrl).toBe(storageMocks.downloadUrl);
    expect(body.cleaningConfig).toEqual(cleaningConfig);
  });
});

describe("callParseApi / callCleanApi / callExecuteApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("callParseApi returns headers/rows/columnTypes", async () => {
    mockFetch({
      headers: ["a", "b"],
      rows: [{ a: 1, b: 2 }],
      columnTypes: [
        { name: "a", type: "numeric", detectedType: "numeric" },
        { name: "b", type: "numeric", detectedType: "numeric" },
      ],
      rowCount: 1,
      colCount: 2,
      fileName: "d.csv",
    });
    const result = await callParseApi(
      "users/u/datasets/d.csv",
      100,
      undefined,
      "hash",
    );
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rowCount).toBe(1);
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.maxRows).toBe(100);
    expect(body.contentHash).toBe("hash");
  });

  it("callCleanApi forwards preview + maxRows", async () => {
    mockFetch({
      rows: [{ a: 1 }],
      diff: { rowsRemoved: 0 },
      columns: [{ name: "a", type: "numeric", detectedType: "numeric" }],
    });
    const result = await callCleanApi(
      "users/u/datasets/d.csv",
      { removeColumns: [] },
      [{ name: "a", type: "numeric", detectedType: "numeric" }],
      true,
      50,
    );
    expect(result.diff).toEqual({ rowsRemoved: 0 });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.preview).toBe(true);
    expect(body.maxRows).toBe(50);
  });

  it("callExecuteApi returns stdout/stderr/exitCode", async () => {
    mockFetch({ stdout: "ok", stderr: "", exitCode: 0, durationMs: 10 });
    const result = await callExecuteApi({
      language: "python",
      code: "print('hi')",
      datasets: [],
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
  });

  it("callExecuteApi rejects empty responses", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 200 }));
    await expect(
      callExecuteApi({ language: "python", code: "x", datasets: [] }),
    ).rejects.toThrow(/empty response/);
  });

  it("callExecuteApi rejects invalid JSON", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    await expect(
      callExecuteApi({ language: "python", code: "x", datasets: [] }),
    ).rejects.toThrow(/invalid JSON/);
  });
});

describe("callStatsApi — gzip response decoding", () => {
  it("decompresses gzip-magic responses transparently", async () => {
    const payload = JSON.stringify({
      result: { column: "num_1", mean: 5, std: 1 },
    });
    const gzipped = gzipSync(strToU8(payload));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(gzipped as unknown as BodyInit, { status: 200 }),
      );
    const result = await callStatsApi("descriptive", ROWS, { column: "num_1" });
    expect(result).toEqual({ column: "num_1", mean: 5, std: 1 });
  });

  it("tolerates NaN values from Python json.dumps", async () => {
    // Bare `NaN` token (as Python emits) — readResponseText + parseJsonResponse
    // must rewrite it to null rather than failing JSON.parse.
    mockFetch(
      { column: "num_1", mean: "NaN", std: 1 },
      {
        envelope: false,
        bodyText: '{"column":"num_1","mean":NaN,"std":1}',
      },
    );
    const result = await callStatsApi("descriptive", ROWS, { column: "num_1" });
    expect(result).toEqual({ column: "num_1", mean: null, std: 1 });
  });
});

describe("dataset generator output sanity", () => {
  it("produces the mixed columns the API tests rely on", () => {
    expect(dataset.columns.map((c) => c.name)).toEqual([
      "num_1",
      "num_2",
      "group",
      "flag",
    ]);
    expect(dataset.rows.length).toBe(20);
  });
});
