import type { CorrelationMatrix, Row } from "@/types";
import { callStatsApi, callStatsApiWithPath } from "./api";
import type { StorageBackedRef } from "./storageBacked";

export function computeCorrelationMatrix(
  rows: Row[],
  numericColumns: string[],
  storageBacked?: StorageBackedRef | null,
): Promise<CorrelationMatrix> {
  if (storageBacked) {
    return callStatsApiWithPath<CorrelationMatrix>(
      "correlation",
      storageBacked.storagePath,
      null,
      { columns: numericColumns },
      { contentHash: storageBacked.contentHash },
    );
  }
  return callStatsApi<CorrelationMatrix>("correlation", rows, {
    columns: numericColumns,
  });
}
