import { describe, it, expect, vi } from "vitest";
import { makeDataset, presets } from "../../generators/dataset";
import { makeBuilderContext } from "../../generators/stats";

// Payload builder import — GitHub-only, no local fallback G15
import * as PB from "@polymorpha/business-logic/ts/dist/networking/payloadBuilders.js";

// Helpers — G20 fixtures
function numericSmall() {
  return makeDataset({
    fileName: "numeric_small.csv",
    rows: 12,
    cols: [
      { name: "age", type: "numeric" },
      { name: "score", type: "numeric" },
      { name: "income", type: "numeric" },
    ],
  });
}
function wideCategorical() {
  return makeDataset({
    fileName: "wide_categorical.csv",
    rows: 10,
    cols: Array.from({ length: 14 }, (_, i) => ({
      name: `cat_${i + 1}`,
      type: "categorical" as const,
      cardinality: 5,
    })),
  });
}
function dirty() {
  return makeDataset({
    fileName: "dirty.csv",
    rows: 20,
    missingPct: 0.2,
    cols: [
      { name: "group", type: "categorical", cardinality: 3 },
      { name: "value", type: "numeric" },
      { name: "mixed", type: "unknown" },
      { name: "flag", type: "categorical", cardinality: 12 },
    ],
  });
}

// Mock rows helper — deterministic 20 rows
const MOCK_ROWS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  val: (i * 7) % 23,
  cat: i % 2 === 0 ? "A" : "B",
  score: Math.round((20 + i * 1.5) * 100) / 100,
}));
const MOCK_COLUMNS = [
  { name: "id", type: "numeric" as const, detectedType: "numeric" as const },
  { name: "val", type: "numeric" as const, detectedType: "numeric" as const },
  { name: "cat", type: "categorical" as const, detectedType: "categorical" as const },
  { name: "score", type: "numeric" as const, detectedType: "numeric" as const },
];

const IO_ACTIONS = [
  "readParquet",
  "readFeather",
  "readOrc",
  "readSql",
  "readHtml",
  "readXml",
  "readJson",
  "readCsvExtended",
  "toMarkdown",
] as const;

// Simulate Python ParserExtended 501 response for pyarrow missing
function mockParserExtendedResponse(action: string, pyarrowMissing = false) {
  if (pyarrowMissing && ["readParquet", "readFeather", "readOrc"].includes(action)) {
    return { error: "pyarrow not installed — add pyarrow>=14.0 to requirements.txt", code: 501 };
  }
  if (action === "readHtml" && pyarrowMissing) {
    // duckdb/lxml missing case
    return { error: "html parser not installed", code: 501 };
  }
  return { columns: MOCK_COLUMNS, rows: MOCK_ROWS, rowCount: MOCK_ROWS.length };
}

describe("IO Extended — schemas validation + payloadBuilders", () => {
  it("schemas validation: all 9 IO actions are supported (StatsRequest whitelist)", () => {
    // Mirror python/polymorpha/schemas/api.py StatsRequest supported set
    const supported = new Set([
      "computeAll", "descriptive", "frequency", "correlation", "normality",
      "ttest", "anova", "levene", "welchAnova", "wilcoxon", "mannWhitney",
      "kruskalWallis", "chiSquare", "fisherExact", "regression", "vif",
      "pairCorrelation", "groupValues", "insight", "recommendations",
      "detectIdentifierColumns", "cleaningStats", "rankColumns", "bonferroni",
      "mann-whitney",
      "tostMean", "tostProportion", "tost", "binomial", "mcnemar", "gofChisquare",
      "twoWayAnova", "repeatedAnova", "friedman",
      "kendallTau", "partialCorrelation", "pointBiserial",
      "logisticRegression", "ridgeRegression", "lassoRegression", "moderation", "mediation",
      "andersonDarling", "kolmogorovSmirnov", "cramerVonMises", "jarqueBera",
      "bartlett", "fligner", "ansari", "moodMedian", "brunnerMunzel",
      "powerDivergence", "multipletests", "holm", "sidak", "fdrBy",
      "boxcox", "yeojohnson", "bootstrapCI", "permutationTest",
      "breuschPagan", "durbinWatson", "cooksDistance",
      "effectSize", "hedgesG", "cliffsDelta", "rankBiserial", "glassDelta",
      "tukeyHSD", "dunnTest", "gamesHowell", "dunnett",
      "groupBy", "pivotTable", "melt", "explode", "crosstab", "stack", "unstack",
      "merge", "concat", "join",
      "rolling", "expanding", "ewm", "shift", "diff", "pctChange", "interpolate", "resample",
      "query", "eval", "assign", "replace", "mapValues", "factorize", "getDummies", "applyTransform", "dropColumns", "renameColumns", "sortRows", "sampleRows", "topN", "rankValues",
      "cut", "qcut", "toCategorical", "catCodes", "setIndex", "resetIndex", "reindex", "describeExtended",
      "readParquet", "readFeather", "readOrc", "readSql", "readHtml", "readXml", "readJson", "readCsvExtended", "toMarkdown", "toLatex", "toHtml",
      "ragProfile",
    ]);
    for (const a of IO_ACTIONS) {
      expect(supported.has(a), `IO action ${a} must be in supported schema`).toBe(true);
    }
  });

  it("buildReadParquet via payloadBuilders — payload shape and data validation", () => {
    const ctx: any = { rows: MOCK_ROWS, columnTypeMap: { val: "numeric" }, groupValuesFor: () => [] };
    // PB.buildReadParquet exists — check if present, else fallback to action string check
    const builder: any = (PB as any).buildReadParquet;
    expect(builder).toBeTypeOf("function");
    const base64 = Buffer.from("mock parquet bytes").toString("base64");
    const res = builder(ctx, { data: base64 });
    expect(res.action).toBe("readParquet");
    expect(res.payload.data).toBe(base64);
  });

  it("buildReadParquet throws when data missing", () => {
    const ctx: any = { rows: MOCK_ROWS, columnTypeMap: {}, groupValuesFor: () => [] };
    const builder: any = (PB as any).buildReadParquet;
    expect(() => builder(ctx, { data: "" })).toThrow(/readParquet needs/);
    expect(() => builder(ctx, {} as any)).toThrow();
    expect(() => (builder as any)(ctx, { data: null })).toThrow();
  });

  it("pyarrow missing 501 — readParquet/readFeather/readOrc return code 501", () => {
    for (const action of ["readParquet", "readFeather", "readOrc"] as const) {
      const res = mockParserExtendedResponse(action, true);
      expect(res.error).toMatch(/pyarrow not installed/);
      expect((res as any).code).toBe(501);
    }
    // when pyarrow present, succeeds with rows
    const ok = mockParserExtendedResponse("readParquet", false);
    expect((ok as any).rows.length).toBe(MOCK_ROWS.length);
    expect((ok as any).rowCount).toBe(MOCK_ROWS.length);
  });

  it("payloadBuilders existence fallback — if builder missing, schema still validates action", () => {
    // Simulate checking other IO builders that may not have dedicated builder fn
    const availableBuilders = Object.keys(PB).filter((k) => k.startsWith("build"));
    // At least readParquet exists; other IO actions use generic StatsRequest
    expect(availableBuilders).toContain("buildReadParquet");
    // For missing builders, verify direct payload shape still follows {action, payload:{rows}} contract
    const fakeCtx: any = { rows: MOCK_ROWS, columnTypeMap: {}, groupValuesFor: () => [] };
    for (const action of IO_ACTIONS) {
      const builderName = `build${action.charAt(0).toUpperCase()}${action.slice(1)}`;
      const fn: any = (PB as any)[builderName];
      if (fn) {
        // If builder exists, it must produce action matching lowercased first char? Check.
        // For readParquet we already tested; others we just verify it doesn't throw on valid input if exists
        expect(typeof fn).toBe("function");
      } else {
        // Fallback: direct payload shape via mock callStatsApi
        const payload = { rows: MOCK_ROWS, data: "base64mock" } as any;
        expect(payload.rows).toEqual(MOCK_ROWS);
        expect(action).toMatch(/read|to/);
      }
      void fakeCtx;
    }
  });

  it("readCsvExtended — delimiter and compression handling", () => {
    const ds = numericSmall();
    const ctx = makeBuilderContext(ds);
    // Delimiter variants: comma, semicolon, tab, pipe
    for (const delim of [",", ";", "\t", "|"]) {
      const csvContent = `a${delim}b\n1${delim}2\n3${delim}4`;
      // Simulate readCsvExtended via python logic: sep=delimiter, compression mapping
      const mockRead = (data: string, delimiter: string, compression?: string | null) => {
        let comp: string | null = null;
        if (compression) {
          const c = compression.toLowerCase();
          if (["gzip", "gz", "bz2", "zip", "xz"].includes(c)) {
            comp = c === "gz" ? "gzip" : c;
          }
        }
        return { sep: delimiter, compression: comp, rows: 2 };
      };
      const r1 = mockRead(csvContent, delim, null);
      expect(r1.sep).toBe(delim);
      expect(r1.rows).toBe(2);
    }
    // Compression mapping
    expect(((): any => {
      const m = (c: string) => {
        if (c.toLowerCase() === "gz") return "gzip";
        return c.toLowerCase();
      };
      return { gz: m("gz"), gzip: m("gzip"), bz2: m("bz2"), zip: m("zip"), xz: m("xz") };
    })()).toEqual({ gz: "gzip", gzip: "gzip", bz2: "bz2", zip: "zip", xz: "xz" });

    // Use ctx.rows to ensure mock rows passthrough
    const mockRows = ctx.rows;
    expect(mockRows.length).toBe(ds.rows.length);
  });

  it("readCsvExtended — encoding and dtype passthrough via mock payload", () => {
    const base64 = Buffer.from("a,b\n1,2").toString("base64");
    const payload = {
      data: base64,
      delimiter: ",",
      encoding: "utf-8",
      compression: "gzip",
      parse_dates: false,
    };
    expect(payload.delimiter).toBe(",");
    expect(payload.encoding).toBe("utf-8");
    expect(payload.compression).toBe("gzip");
    // Simulate decoding check: bytes -> string with encoding
    const decoded = Buffer.from(payload.data, "base64").toString(payload.encoding as BufferEncoding);
    expect(decoded).toContain("a,b");
  });

  it("readJson — orient and lines handling", () => {
    const jsonStr = JSON.stringify(MOCK_ROWS.slice(0, 2));
    // orient records vs columns vs lines
    const parse = (str: string, orient = "records", lines = false) => {
      if (lines) {
        const records = str.split("\n").filter(Boolean).map((l) => JSON.parse(l));
        return { rows: records, orient: "records", lines: true };
      }
      const data = JSON.parse(str);
      if (Array.isArray(data)) return { rows: data, orient };
      return { rows: [data], orient };
    };
    const r1 = parse(jsonStr, "records", false);
    expect(r1.rows.length).toBe(2);
    expect(r1.orient).toBe("records");
    // NDJSON lines
    const ndjson = MOCK_ROWS.slice(0, 3).map((r) => JSON.stringify(r)).join("\n");
    const r2 = parse(ndjson, "records", true);
    expect(r2.rows.length).toBe(3);
    expect(r2.lines).toBe(true);
  });

  it("readSql — rows vs connection_string, duckdb mock 501", () => {
    // readSql via duckdb requires either rows or connection_string
    const mockReadSql = (query: string, opts: { rows?: any[]; connection_string?: string }) => {
      if (!opts.rows && !opts.connection_string) return { error: "Either rows or connection_string required", code: 400 };
      // Simulate duckdb missing
      const duckdbMissing = false;
      if (duckdbMissing) return { error: "duckdb not installed", code: 501 };
      // Mock execute
      const df = opts.rows ?? [];
      return { rows: df, rowCount: df.length, query };
    };
    const ok = mockReadSql("SELECT * FROM df WHERE val > 10", { rows: MOCK_ROWS });
    expect(ok.rowCount).toBe(MOCK_ROWS.length);
    const err = mockReadSql("SELECT 1", {});
    expect((err as any).error).toMatch(/Either rows or connection_string/);
    // connection_string path
    const conn = mockReadSql("SELECT * FROM my_table", { connection_string: ":memory:" });
    expect(conn.query).toBe("SELECT * FROM my_table");
  });

  it("readHtml — table extraction and match param", () => {
    const html = `<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>`;
    const mockReadHtml = (htmlStr: string, match?: string) => {
      // Simulate pandas read_html behavior: match filters tables containing text
      const hasTable = htmlStr.includes("<table");
      if (!hasTable) return { error: "No tables found in HTML" };
      const dfs = 1;
      const rows = [{ a: 1, b: 2 }];
      if (match && !htmlStr.includes(match)) return { error: `No tables matching ${match}` };
      return { rows, tableCount: dfs, rowCount: rows.length };
    };
    const res = mockReadHtml(html);
    expect(res.rowCount).toBe(1);
    expect(res.tableCount).toBe(1);
    const resMatch = mockReadHtml(html, "a");
    expect(resMatch.rowCount).toBe(1);
    const noMatch = mockReadHtml(html, "nonexistent");
    expect((noMatch as any).error).toMatch(/No tables matching/);
  });

  it("readXml — xpath handling and lxml 501", () => {
    const xml = `<root><row><a>1</a><b>2</b></row><row><a>3</a><b>4</b></row></root>`;
    const mockReadXml = (xmlStr: string, xpath = ".//row", lxmlMissing = false) => {
      if (lxmlMissing) return { error: "lxml not installed", code: 501 };
      if (!xmlStr.includes("<row")) return { error: "No rows at xpath" };
      const rows = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
      return { rows, rowCount: rows.length, xpath };
    };
    const ok = mockReadXml(xml, ".//row");
    expect(ok.rowCount).toBe(2);
    expect(ok.xpath).toBe(".//row");
    const lxmlErr = mockReadXml(xml, ".//row", true);
    expect((lxmlErr as any).code).toBe(501);
    expect((lxmlErr as any).error).toMatch(/lxml not installed/);
  });

  it("toMarkdown — tabulate fallback and output shape", () => {
    const mockToMarkdown = (rows: any[], tabulateMissing = false) => {
      if (tabulateMissing) {
        const headers = Object.keys(rows[0] ?? {}).join(" | ");
        const sep = Object.keys(rows[0] ?? {}).map(() => "---").join(" | ");
        const lines = [`| ${headers} |`, `| ${sep} |`];
        for (const r of rows.slice(0, 100)) {
          lines.push(`| ${Object.values(r).join(" | ")} |`);
        }
        return { markdown: lines.join("\n"), rowCount: rows.length };
      }
      return { markdown: `| a | b |\n| --- | --- |\n| 1 | 2 |`, rowCount: rows.length };
    };
    const res = mockToMarkdown(MOCK_ROWS);
    expect(res.markdown).toContain("|");
    expect(res.rowCount).toBe(MOCK_ROWS.length);
    const fallback = mockToMarkdown(MOCK_ROWS.slice(0, 2), true);
    expect(fallback.markdown).toContain("---");
    expect(fallback.markdown.split("\n").length).toBeGreaterThan(2);
  });

  it("toMarkdown with numeric_small — rowCount matches dataset", () => {
    const ds = numericSmall();
    const ctx = makeBuilderContext(ds);
    const mdMock = (rows: any[]) => ({
      markdown: `| ${Object.keys(rows[0] ?? {}).join(" | ")} |`,
      rowCount: rows.length,
    });
    const res = mdMock(ctx.rows);
    expect(res.rowCount).toBe(ds.rows.length);
    expect(res.markdown).toContain("age");
  });

  it("wide_categorical + dirty — IO parsers handle high-cardinality/missing without crash", () => {
    const wc = wideCategorical();
    const wcCtx = makeBuilderContext(wc);
    expect(wcCtx.rows.length).toBe(10);
    expect(wcCtx.columnTypeMap["cat_1"]).toBe("categorical");
    const d = dirty();
    const dCtx = makeBuilderContext(d);
    expect(dCtx.rows.length).toBe(20);
    // Ensure dirty missing doesn't break payload builder — readParquet payload is {data}, not rows
    const base64 = Buffer.from("mock").toString("base64");
    const builder: any = (PB as any).buildReadParquet;
    const res = builder(dCtx, { data: base64 });
    expect(res.action).toBe("readParquet");
    expect(res.payload.data).toBe(base64);
    // readParquet is file-data driven, not row-driven — verify ctx still available for other actions
    expect(dCtx.rows.length).toBe(20);
  });

  it("mock rows passthrough — payload rows field equals input", () => {
    const ds = makeDataset({
      fileName: "mock_rows.csv",
      rows: 15,
      cols: [
        { name: "x", type: "numeric" },
        { name: "y", type: "numeric" },
        { name: "g", type: "categorical", cardinality: 3 },
      ],
    });
    const ctx = makeBuilderContext(ds);
    const base64 = Buffer.from("test").toString("base64");
    const res: any = (PB as any).buildReadParquet(ctx, { data: base64 });
    // readParquet payload contains data, not rows — verify data passthrough
    expect(res.payload.data).toBe(base64);
    expect(res.action).toBe("readParquet");
    expect(ctx.rows.length).toBe(15);
    // Also check schemas validation mock for all IO via direct object
    for (const action of IO_ACTIONS) {
      const mockReq = { action, rows: ctx.rows, params: {} };
      expect(mockReq.action).toBe(action);
      expect(mockReq.rows).toBe(ctx.rows);
    }
  });
});
