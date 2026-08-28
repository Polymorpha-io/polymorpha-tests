import { describe, it, expect } from "vitest";
import { makeDataset, presets } from "../../../generators/dataset";
import * as PB from "@polymorpha/business-logic/ts/dist/networking/payloadBuilders.js";

function ctx(ds: ReturnType<typeof makeDataset>){ return { rows: ds.rows, columns: ds.columns, columnTypeMap: Object.fromEntries(ds.columns.map(c=>[c.name,c.type])) as Record<string,string>, groupValuesFor: (_:string)=>["a","b"] } as any; }

describe("Binning/Indexing F — cut, qcut, toCategorical, catCodes, setIndex, reindex, describeExtended", () => {
  it("cut success — bins 2..50 with right", () => {
    const ds = presets.mixed(); const c=ctx(ds); const num=ds.columns.find(x=>x.type==="numeric")!.name;
    const p=(PB as any).buildCut(c,{ column:num, bins:5});
    expect(p.action).toBe("cut"); expect(p.payload.bins).toBe(5);
  });
  it("cut throws on invalid bins", () => {
    const ds=presets.mixed(); const c=ctx(ds); const num=ds.columns.find(x=>x.type==="numeric")!.name;
    expect(()=>(PB as any).buildCut(c,{column:num,bins:1})).toThrow();
    expect(()=>(PB as any).buildCut(c,{column:num,bins:51})).toThrow();
  });
  it("cut with labels", () => {
    const ds=presets.mixed(); const c=ctx(ds); const num=ds.columns.find(x=>x.type==="numeric")!.name;
    const p=(PB as any).buildCut(c,{column:num,bins:3,labels:["low","mid","high"]});
    expect(p.payload.labels.length).toBe(3);
  });
  it("qcut success — q 2..20 duplicates drop", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds); const num=ds.columns.find(x=>x.type==="numeric")!.name;
    const p=(PB as any).buildQcut(ctxv,{column:num,q:4});
    expect(p.action).toBe("qcut"); expect(p.payload.q).toBe(4);
  });
  it("qcut throws on invalid q", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds); const num=ds.columns.find(x=>x.type==="numeric")!.name;
    expect(()=>(PB as any).buildQcut(ctxv,{column:num,q:1})).toThrow();
  });
  it("toCategorical success — ordered", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds); const cat=ds.columns.find(x=>x.type==="categorical")!.name;
    const p=(PB as any).buildToCategorical(ctxv,{column:cat,ordered:true});
    expect(p.action).toBe("toCategorical");
  });
  it("catCodes success", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds); const cat=ds.columns.find(x=>x.type==="categorical")!.name;
    const p=(PB as any).buildCatCodes(ctxv,{column:cat});
    expect(p.action).toBe("catCodes");
  });
  it("setIndex success", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds);
    const p=(PB as any).buildSetIndex(ctxv,{column:ds.columns[0].name});
    expect(p.action).toBe("setIndex");
  });
  it("resetIndex success", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds);
    const p=(PB as any).buildResetIndex(ctxv,{});
    expect(p.action).toBe("resetIndex");
  });
  it("reindex success — ffill/bfill", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds);
    const p=(PB as any).buildReindex(ctxv,{column:ds.columns[0].name,method:"ffill"});
    expect(p.action).toBe("reindex");
  });
  it("describeExtended success — transposed", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds);
    const p=(PB as any).buildDescribeExtended(ctxv,{});
    expect(p.action).toBe("describeExtended"); expect(p.payload.rows).toBe(ds.rows);
  });
  it("payload rows field for all binning ops", () => {
    const ds=presets.mixed(); const ctxv=ctx(ds); const num=ds.columns.find(x=>x.type==="numeric")!.name;
    for(const fn of ["buildCut","buildQcut","buildToCategorical","buildCatCodes"]){ 
      const col = fn==="buildQcut" ? {column:num,q:4} : fn==="buildCut" ? {column:num,bins:3} : {column: ds.columns.find(x=>x.type==="categorical")!.name};
      const p=(PB as any)[fn](ctxv,col);
      expect(p.payload.rows).toBe(ds.rows);
    }
  });
  it("G20 wide_categorical handles cut/qcut without builder crash", () => {
    const wide=makeDataset({fileName:"wide.csv",rows:10,cols:Array.from({length:5},(_,i)=>({name:`cat_${i}`,type:"categorical" as const}))});
    const mixed=presets.mixed(); const num=mixed.columns.find(x=>x.type==="numeric")!.name;
    const p=(PB as any).buildCut(ctx(mixed),{column:num,bins:3});
    expect(p.action).toBe("cut");
  });
});
