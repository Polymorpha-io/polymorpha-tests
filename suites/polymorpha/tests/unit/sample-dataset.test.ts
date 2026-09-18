import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs from the repo root; import.meta.url is unreliable here.
const CSV_PATH = join(
  process.cwd(),
  "public",
  "samples",
  "students-performance.csv",
);

function loadRows(): { header: string[]; rows: string[][] } {
  const text = readFileSync(CSV_PATH, "utf8");
  const lines = text.split("\n").filter((line) => line.length > 0);
  const header = lines[0].split(",");
  return { header, rows: lines.slice(1).map((line) => line.split(",")) };
}

describe("students-performance.csv sample asset", () => {
  it("has the frozen 7-column shape and 200 data rows", () => {
    const { header, rows } = loadRows();
    expect(header).toEqual([
      "student_id",
      "gender",
      "study_hours",
      "attendance_pct",
      "prior_gpa",
      "final_score",
      "passed",
    ]);
    expect(rows).toHaveLength(200);
    for (const row of rows) expect(row).toHaveLength(header.length);
  });

  it("is dirty by design: missing hours within 5–12%", () => {
    const { header, rows } = loadRows();
    const hoursIdx = header.indexOf("study_hours");
    const missing = rows.filter((row) => row[hoursIdx] === "").length;
    expect(missing / rows.length).toBeGreaterThanOrEqual(0.05);
    expect(missing / rows.length).toBeLessThanOrEqual(0.12);
  });

  it("is dirty by design: one attendance typo outlier", () => {
    const { header, rows } = loadRows();
    const attIdx = header.indexOf("attendance_pct");
    const outliers = rows.filter((row) => Number(row[attIdx]) > 200);
    expect(outliers.length).toBeGreaterThanOrEqual(1);
  });

  it("is dirty by design: one exact duplicate row", () => {
    const { rows } = loadRows();
    const seen = new Set<string>();
    let dupes = 0;
    for (const row of rows) {
      const key = row.join("|");
      if (seen.has(key)) dupes += 1;
      seen.add(key);
    }
    expect(dupes).toBeGreaterThanOrEqual(1);
  });

  it("gender is 2-level and final_score is numeric", () => {
    const { header, rows } = loadRows();
    const genderIdx = header.indexOf("gender");
    const scoreIdx = header.indexOf("final_score");
    expect(new Set(rows.map((row) => row[genderIdx])).size).toBe(2);
    const numeric = rows.filter(
      (row) => row[scoreIdx] !== "" && Number.isFinite(Number(row[scoreIdx])),
    ).length;
    expect(numeric / rows.length).toBeGreaterThanOrEqual(0.95);
  });
});
