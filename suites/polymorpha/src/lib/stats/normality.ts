import type { NormalityResult } from "@/types";
import { callStatsApi, callStatsApiWithPath } from "./api";
import type { StorageBackedRef } from "./storageBacked";

export type NormalityMethod = "auto" | "shapiro-wilk" | "lilliefors";

export function testNormality(
  rows: Array<Record<string, unknown>>,
  colName: string,
  method: NormalityMethod = "auto",
  storageBacked?: StorageBackedRef | null,
): Promise<NormalityResult> {
  if (storageBacked) {
    return callStatsApiWithPath<NormalityResult>(
      "normality",
      storageBacked.storagePath,
      null,
      { column: colName, method },
      { contentHash: storageBacked.contentHash },
    );
  }
  return callStatsApi<NormalityResult>("normality", rows, {
    column: colName,
    method,
  });
}
