import { describe, it, expect } from "vitest";
import { makeDataset, presets } from "../../../generators/dataset";
import * as PB from "@polymorpha/business-logic/ts/dist/networking/payloadBuilders.js";

function mixed() { return presets.mixed(); }
function makeCtx(ds: ReturnType<typeof makeDataset>) { return { rows: ds.rows, columns: ds.columns, columnTypeMap: Object.fromEntries(ds.columns.map(c=>[c.name,c.type])) as Record<string,string>, groupValuesFor: (_:string)=>["a","b"] } as any; }

describe("Transform E — query, assign, replace, mapValues, factorize, getDummies, apply, drop, rename, sort, sample, topN, rank", () => {
  it("query success — safe expr", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const col = ds.columns.find(c=>c.type==="numeric")!.name;
    const payload = (PB as any).buildQuery(ctx, { expr: `${col} > 10` });
    expect(payload.action).toBe("query"); expect(payload.payload.rows).toBe(ds.rows);
  });
  it("query blocks unsafe — throws on Blocked name", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    expect(() => (PB as any).buildQuery(ctx, { expr: 'os.system("rm")' })).toThrow();
  });
  it("query throws on empty expr", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    expect(() => (PB as any).buildQuery(ctx, { expr: "" })).toThrow();
  });
  it("assign success — new column via expr", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const col = ds.columns.find(c=>c.type==="numeric")!.name;
    const p = (PB as any).buildAssign(ctx, { column: "new_col", expr: `${col} * 2` });
    expect(p.action).toBe("assign"); expect(p.payload.column).toBe("new_col");
  });
  it("assign throws when missing column/expr", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    expect(() => (PB as any).buildAssign(ctx, { column: "", expr: "x+1" })).toThrow();
  });
  it("replace success — regex mapping", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const cat = ds.columns.find(c=>c.type==="categorical")!.name;
    const p = (PB as any).buildReplace(ctx, { column: cat, toReplace: "a", value: "b", regex: false });
    expect(p.action).toBe("replace");
  });
  it("mapValues success — dict mapping", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const cat = ds.columns.find(c=>c.type==="categorical")!.name;
    const p = (PB as any).buildMapValues(ctx, { column: cat, mapping: { a: "alpha", b: "beta" } });
    expect(p.action).toBe("mapValues");
  });
  it("factorize success — creates codes", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const cat = ds.columns.find(c=>c.type==="categorical")!.name;
    const p = (PB as any).buildFactorize(ctx, { column: cat });
    expect(p.action).toBe("factorize");
  });
  it("getDummies success — drop_first", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const cat = ds.columns.find(c=>c.type==="categorical")!.name;
    const p = (PB as any).buildGetDummies(ctx, { columns: [cat], dropFirst: true });
    expect(p.action).toBe("getDummies");
  });
  it("apply success — x expr", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const col = ds.columns.find(c=>c.type==="numeric")!.name;
    const p = (PB as any).buildApplyTransform(ctx, { column: col, func: "x * 2 + 1" });
    expect(p.action).toBe("applyTransform");
  });
  it("drop success — payload rows", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const p = (PB as any).buildDropColumns(ctx, { columns: [ds.columns[0].name] });
    expect(p.action).toBe("dropColumns");
  });
  it("rename success", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const p = (PB as any).buildRenameColumns(ctx, { mapping: { [ds.columns[0].name]: "renamed" } });
    expect(p.action).toBe("renameColumns");
  });
  it("sortRows success — by + ascending", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const p = (PB as any).buildSortRows(ctx, { by: [ds.columns[0].name], ascending: [true] });
    expect(p.action).toBe("sortRows");
  });
  it("sampleRows success — n", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const p = (PB as any).buildSampleRows(ctx, { n: 5 });
    expect(p.action).toBe("sampleRows");
  });
  it("topN success — column n largest", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const col = ds.columns.find(c=>c.type==="numeric")!.name;
    const p = (PB as any).buildTopN(ctx, { column: col, n: 5, largest: true });
    expect(p.action).toBe("topN");
  });
  it("rankValues success — method dense", () => {
    const ds = mixed(); const ctx = makeCtx(ds);
    const col = ds.columns.find(c=>c.type==="numeric")!.name;
    const p = (PB as any).buildRankValues(ctx, { column: col, method: "dense" });
    expect(p.action).toBe("rankValues");
  });
  it("G20 wide_categorical + dirty — transform builders payload rows", () => {
    const wide = makeDataset({ fileName: "wide.csv", rows: 10, cols: Array.from({length:5},(_,i)=>({name:`cat_${i}`,type:"categorical" as const,cardinality:3}))});
    const dirty = makeDataset({ fileName: "dirty.csv", rows: 20, missingPct:0.2, cols:[{name:"num",type:"numeric"},{name:"cat",type:"categorical"}]});
    for(const ds of [wide, dirty]){ const ctx=makeCtx(ds); const p=(PB as any).buildQuery(ctx, { expr: `${ds.columns[0].name} == "${ds.rows[0][ds.columns[0].name]}"` }); expect(p.payload.rows).toBe(ds.rows); }
  });
});
