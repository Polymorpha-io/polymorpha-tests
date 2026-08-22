import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

function resolveSrcPath(p: string): string {
  if (existsSync(p)) return p;
  const alt = `suites/polymorpha/${p}`;
  if (existsSync(alt)) return alt;
  return p;
}

function tscShowConfig(tsconfig: string): string {
  try {
    return execSync(`npx tsc -p ${tsconfig} --showConfig`, { encoding: "utf-8" });
  } catch {
    const alt = `suites/polymorpha/${tsconfig}`;
    if (existsSync(alt)) {
      return execSync(`npx tsc -p ${alt} --showConfig`, { encoding: "utf-8" });
    }
    throw new Error(`tsconfig not found: ${tsconfig}`);
  }
}

describe("P1-A G10 strict inventory", () => {
  it("effective tsconfig strict is true for app and node", () => {
    const appShow = tscShowConfig("tsconfig.app.json");
    const nodeShow = tscShowConfig("tsconfig.node.json");
    expect(appShow).toMatch(/"strict"\s*:\s*true/);
    expect(nodeShow).toMatch(/"strict"\s*:\s*true/);
  });

  it("top 3 files have 0 any", () => {
    const files = [
      "src/components/ExportPanel/htmlPreviewUtils.tsx",
      "src/components/DataPreview/DataModelerCanvas.tsx",
      "src/components/AnalysePanel/tabs/mlApi.ts",
    ];
    for (const f of files) {
      const resolved = resolveSrcPath(f);
      const content = readFileSync(resolved, "utf-8");
      // Count true any type usages, ignore comments and string literals containing "any"
      const lines = content.split("\n");
      const anyLines = lines.filter((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//")) return false;
        if (trimmed.startsWith("*")) return false;
        // Match `any` as type, not in comment
        return /\bany\b/.test(line) && /:\s*any\b|as\s+any\b|<any>/.test(line);
      });
      expect(anyLines, `${resolved} should have 0 any, found: ${anyLines.join("\n")}`).toHaveLength(0);
    }
  });

  it("production any count decreased after top 3 fix (162 -> <162)", { timeout: 15000 }, () => {
    const before = 162;
    const srcDir = existsSync("src") ? "src" : "suites/polymorpha/src";
    const out = execSync(
      `powershell -Command "Get-ChildItem -Path ${srcDir} -Recurse -Include *.ts,*.tsx | Select-String -Pattern ':\\s*any\\b|as\\s+any\\b|<any\\b|Record<.*any' | Measure-Object | Select-Object -ExpandProperty Count"`,
      { encoding: "utf-8" },
    );
    const count = parseInt(out.trim(), 10);
    expect(count).toBeLessThan(before);
  });
});
