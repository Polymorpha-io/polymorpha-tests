import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const mockSetRaw = vi.fn(async () => {});
const mockUploadBytes = vi.fn(async () => ({}));

vi.mock("@/store/useDataStore", () => ({
  useDataStore: {
    getState: () => ({ setRaw: mockSetRaw }),
  },
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
}));

vi.mock("@/config/firebase", () => ({
  getFirebaseAuth: () => null,
  getFirebaseStorage: () => ({}),
}));

import {
  parseSampleCsv,
  readSampleIntent,
  useSampleDataset,
} from "@/components/Upload/hooks/useSampleDataset";

const CSV = [
  "student_id,gender,study_hours,final_score",
  "S-0001,F,12.5,81",
  "S-0002,M,,74",
  "S-0003,F,4.0,58",
].join("\n");

function mockFetchOk(text: string, status = 200) {
  global.fetch = vi.fn(async () => new Response(text, { status }));
}

describe("readSampleIntent", () => {
  it("parses sample/focus/src params", () => {
    expect(
      readSampleIntent("?sample=students&focus=tTest&src=dictionary:t-test"),
    ).toEqual({ sample: "students", focus: "tTest", src: "dictionary:t-test" });
  });

  it("returns nulls when absent", () => {
    expect(readSampleIntent("")).toEqual({
      sample: null,
      focus: null,
      src: null,
    });
    expect(readSampleIntent("?utm_source=x")).toEqual({
      sample: null,
      focus: null,
      src: null,
    });
  });
});

describe("parseSampleCsv", () => {
  it("parses headers, rows, and detects types", () => {
    const dataset = parseSampleCsv(CSV, "students-performance.csv");
    expect(dataset.fileName).toBe("students-performance.csv");
    expect(dataset.columns.map((c) => c.name)).toEqual([
      "student_id",
      "gender",
      "study_hours",
      "final_score",
    ]);
    expect(dataset.rows).toHaveLength(3);
    const byName = Object.fromEntries(
      dataset.columns.map((c) => [c.name, c.type]),
    );
    expect(byName.final_score).toBe("numeric");
    expect(byName.gender).toBe("categorical");
  });

  it('normalizes "" to null', () => {
    const dataset = parseSampleCsv(CSV, "s.csv");
    expect((dataset.rows[1] as Record<string, unknown>).study_hours).toBeNull();
  });

  it("throws inline on empty input (never an empty dataset)", () => {
    expect(() => parseSampleCsv("a,b\n", "s.csv")).toThrow(/empty|parseable/);
  });
});

describe("useSampleDataset", () => {
  beforeEach(() => {
    mockSetRaw.mockClear();
    mockUploadBytes.mockReset();
    mockUploadBytes.mockResolvedValue({});
  });

  it("loads, parses, and scratch-uploads to a pending path for kernel Run", async () => {
    mockFetchOk(CSV);
    const { result } = renderHook(() => useSampleDataset());
    await act(async () => {
      await result.current.loadSample("card");
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
    expect(mockSetRaw).toHaveBeenCalledTimes(1);
    const [dataset, opts] = mockSetRaw.mock.calls[0];
    expect(dataset.columns).toHaveLength(4);
    expect(dataset.rows).toHaveLength(3);
    expect(opts.totalRowCount).toBe(3);
    expect(opts.storagePath).toMatch(
      /^anonymous\/pending\/[0-9a-f]+\/students-performance\.csv$/,
    );
  });

  it("falls back to local-only when the scratch upload fails", async () => {
    mockFetchOk(CSV);
    mockUploadBytes.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useSampleDataset());
    await act(async () => {
      await result.current.loadSample("card");
    });
    expect(result.current.error).toBeNull();
    expect(mockSetRaw).toHaveBeenCalledTimes(1);
    const [, opts] = mockSetRaw.mock.calls[0];
    expect(opts).toEqual({ totalRowCount: 3, storagePath: null });
  });

  it("surfaces fetch failure inline and never touches the store", async () => {
    mockFetchOk("boom", 500);
    const { result } = renderHook(() => useSampleDataset());
    await act(async () => {
      await result.current.loadSample("hero");
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toMatch(/HTTP 500/);
    expect(mockSetRaw).not.toHaveBeenCalled();
  });

  it("retry reloads with the last source", async () => {
    mockFetchOk("boom", 500);
    const { result } = renderHook(() => useSampleDataset());
    await act(async () => {
      await result.current.loadSample("dictionary:t-test");
    });
    expect(result.current.error).not.toBeNull();
    mockFetchOk(CSV);
    await act(async () => {
      result.current.retry();
    });
    // Retry is fire-and-forget and now awaits hash + scratch upload.
    await waitFor(() => expect(mockSetRaw).toHaveBeenCalledTimes(1));
    expect(result.current.error).toBeNull();
  });
});
