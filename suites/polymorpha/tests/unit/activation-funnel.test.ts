import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS } from "@/constants/analytics";
import { FUNNEL_META_KEYS, sanitizeFunnelMeta } from "@/lib/tracking";

describe("activation funnel vocabulary", () => {
  it("freezes funnel event names (central e2e consumes these)", () => {
    expect(ANALYTICS_EVENTS.SAMPLE_STARTED).toBe("sample_started");
    expect(ANALYTICS_EVENTS.UPLOAD_DONE).toBe("upload_done");
    expect(ANALYTICS_EVENTS.PREVIEW_DONE).toBe("preview_done");
    expect(ANALYTICS_EVENTS.STATS_VIEWED).toBe("stats_viewed");
    expect(ANALYTICS_EVENTS.EXPORT_DONE).toBe("export_done");
  });

  it("keeps legacy event names untouched", () => {
    expect(ANALYTICS_EVENTS.UPLOAD).toBe("upload");
    expect(ANALYTICS_EVENTS.DOWNLOAD).toBe("download");
    expect(ANALYTICS_EVENTS.PAGEVIEW).toBe("pageview");
  });
});

describe("sanitizeFunnelMeta (PII guard)", () => {
  it("keeps allowed count/name keys", () => {
    expect(
      sanitizeFunnelMeta({
        sourceType: "sample",
        rows: 200,
        cols: 7,
        source: "dictionary:t-test",
        step: "preview",
        colNames: ["a", "b"],
      }),
    ).toEqual({
      sourceType: "sample",
      rows: 200,
      cols: 7,
      source: "dictionary:t-test",
      step: "preview",
      colNames: ["a", "b"],
    });
  });

  it("drops row objects, cell values, and unknown keys", () => {
    expect(
      sanitizeFunnelMeta({
        rows: [{ a: 1 }, { a: 2 }],
        cols: ["a", "b"],
        cells: [1, 2, 3],
        fileName: "secret.csv",
        file: new Blob(["x"]),
        password: "hunter2",
      }),
    ).toEqual({});
  });

  it("keeps rows/cols as finite counts", () => {
    expect(sanitizeFunnelMeta({ rows: 200, cols: 7 })).toEqual({
      rows: 200,
      cols: 7,
    });
    expect(sanitizeFunnelMeta({ rows: NaN, cols: 7 })).toEqual({ cols: 7 });
  });

  it("exposes the frozen allowlist", () => {
    expect([...FUNNEL_META_KEYS].sort()).toEqual(
      ["colNames", "cols", "rows", "source", "sourceType", "step"].sort(),
    );
  });
});
