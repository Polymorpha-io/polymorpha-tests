import { describe, it, expect, vi, beforeEach } from "vitest";
import { callStatsApi, STATS_ACTIONS } from "@/lib/stats/api";

// Mock firebase config
let mockAuthUser: { getIdToken: () => Promise<string> } | null = {
  getIdToken: () => Promise.resolve("mock-token"),
};
vi.mock("@/config/firebase", () => ({
  getFirebaseAuth: () => ({ currentUser: mockAuthUser }),
}));

const MOCK_ROWS = [
  { col1: 1, col2: 2 },
  { col1: 3, col2: 4 },
  { col1: 5, col2: 6 },
  { col1: 7, col2: 8 },
  { col1: 9, col2: 10 },
];

describe("callStatsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
    mockAuthUser = { getIdToken: () => Promise.resolve("mock-token") };
  });

  // Input validation
  describe("input validation", () => {
    it("rejects empty action", async () => {
      await expect(callStatsApi("", MOCK_ROWS, {})).rejects.toThrow(
        "action is required",
      );
    });

    it("rejects unknown action", async () => {
      await expect(
        callStatsApi("unknownAction", MOCK_ROWS, {}),
      ).rejects.toThrow("unknown action");
    });

    it("rejects insufficient rows", async () => {
      await expect(
        callStatsApi("descriptive", [], { column: "col1" }),
      ).rejects.toThrow("requires at least");
    });

    it("rejects zero rows for actions that need data", async () => {
      await expect(
        callStatsApi("ttest", [], { column: "col1", type: "one-sample" }),
      ).rejects.toThrow("requires at least");
    });

    it("rejects empty column name", async () => {
      await expect(
        callStatsApi("descriptive", MOCK_ROWS, { column: "" }),
      ).rejects.toThrow("cannot be empty");
    });

    it("rejects nonexistent column", async () => {
      await expect(
        callStatsApi("descriptive", MOCK_ROWS, { column: "nonexistent" }),
      ).rejects.toThrow("not found in dataset");
    });
  });

  // Auth token
  describe("auth token handling", () => {
    it("sends auth header when token is available", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ result: { column: "col1", mean: 5, std: 3.16 } }),
          { status: 200 },
        ),
      );

      await callStatsApi("descriptive", MOCK_ROWS, { column: "col1" });
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        }),
      );
    });

    it("does not send auth header when no user", async () => {
      mockAuthUser = null;

      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ result: { column: "col1", mean: 5, std: 3.16 } }),
          { status: 200 },
        ),
      );

      await callStatsApi("descriptive", MOCK_ROWS, { column: "col1" });
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  });

  // Response envelope handling
  describe("response envelope handling", () => {
    it("extracts result from envelope", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            result: { column: "col1", mean: 5, std: 3.16 },
            error: null,
          }),
          { status: 200 },
        ),
      );
      const result = await callStatsApi("descriptive", MOCK_ROWS, {
        column: "col1",
      });
      expect(result).toEqual({ column: "col1", mean: 5, std: 3.16 });
    });

    it("throws on envelope error", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ result: null, error: "Server error" }), {
          status: 200,
        }),
      );
      await expect(
        callStatsApi("descriptive", MOCK_ROWS, { column: "col1" }),
      ).rejects.toThrow("Server error");
    });

    it("handles legacy response (no envelope)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ column: "col1", mean: 5, std: 3.16 }), {
          status: 200,
        }),
      );
      const result = await callStatsApi("descriptive", MOCK_ROWS, {
        column: "col1",
      });
      expect(result).toEqual({ column: "col1", mean: 5, std: 3.16 });
    });
  });

  // Error handling
  describe("error handling", () => {
    it("throws on HTTP error", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: "Bad request" }), { status: 400 }),
      );
      await expect(
        callStatsApi("descriptive", MOCK_ROWS, { column: "col1" }),
      ).rejects.toThrow("Bad request");
    });

    it("throws on network error", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));
      await expect(
        callStatsApi("descriptive", MOCK_ROWS, { column: "col1" }),
      ).rejects.toThrow("Network failure");
    });

    it("throws on timeout", async () => {
      vi.mocked(fetch).mockRejectedValue(
        new DOMException("Aborted", "AbortError"),
      );
      await expect(
        callStatsApi("descriptive", MOCK_ROWS, { column: "col1" }),
      ).rejects.toThrow("timed out");
    });
  });

  // Output validation
  describe("output validation", () => {
    it("validates t-test result fields", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              t: 2.5,
              pValue: 0.03,
              df: 4,
              significant: true,
              type: "one-sample",
              column: "col1",
            },
          }),
          { status: 200 },
        ),
      );
      const result = await callStatsApi<Record<string, unknown>>(
        "ttest",
        MOCK_ROWS,
        { column: "col1", type: "one-sample" },
      );
      expect(result.t).toBe(2.5);
      expect(result.pValue).toBe(0.03);
      expect(result.significant).toBe(true);
    });

    it("rejects invalid p-value", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ result: { pValue: 1.5 } }), {
          status: 200,
        }),
      );
      await expect(
        callStatsApi("ttest", MOCK_ROWS, {
          column: "col1",
          type: "one-sample",
        }),
      ).rejects.toThrow("p-value out of range");
    });

    it("rejects correlation r out of range", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ result: { r: 2.0, pValue: 0.5, c1: "a", c2: "b" } }),
          { status: 200 },
        ),
      );
      await expect(
        callStatsApi("pairCorrelation", MOCK_ROWS, {
          column1: "col1",
          column2: "col2",
        }),
      ).rejects.toThrow("correlation coefficient r out of range");
    });

    it("validates correlation matrix shape", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              columns: ["a", "b"],
              values: [
                [1, 0.5],
                [0.5, 1],
              ],
            },
          }),
          { status: 200 },
        ),
      );
      const result = await callStatsApi<{
        columns: string[];
        values: number[][];
      }>("correlation", MOCK_ROWS, { columns: ["col1", "col2"] });
      expect(result.columns).toEqual(["a", "b"]);
      expect(result.values).toEqual([
        [1, 0.5],
        [0.5, 1],
      ]);
    });

    it("rejects non-square correlation matrix", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            result: { columns: ["a", "b"], values: [[1], [0.5]] },
          }),
          { status: 200 },
        ),
      );
      await expect(
        callStatsApi("correlation", MOCK_ROWS, { columns: ["col1", "col2"] }),
      ).rejects.toThrow("non-square");
    });
  });

  // Action registry
  describe("STATS_ACTIONS metadata", () => {
    it("has minRows for all actions", () => {
      for (const meta of Object.values(STATS_ACTIONS)) {
        expect(meta.minRows).toBeGreaterThanOrEqual(0);
        expect(meta.label).toBeTruthy();
      }
    });
  });
});
