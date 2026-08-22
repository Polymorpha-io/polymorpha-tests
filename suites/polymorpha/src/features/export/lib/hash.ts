/**
 * hash utilities for export memoization — hashDataset truth (G21) + prefs hash.
 */
import { hashString } from "@polymorpha/business-logic";
import type { Dataset, ExportPreferences } from "@/types";

export async function hashDatasetAsync(
  dataset: Dataset,
  salt?: string | null,
): Promise<string> {
  const payload = `${salt ?? ""}:${dataset.fileName}:${dataset.columns.map((c) => `${c.name}:${c.type}`).join(",")}:${dataset.rows.length}:${JSON.stringify(dataset.rows.slice(0, 5))}`;
  const hex = await hashString(payload);
  return `h${hex.slice(0, 12)}_${dataset.rows.length}_${dataset.columns.length}`;
}

export function hashDatasetSync(
  dataset: Dataset,
  salt?: string | null,
): string {
  const str = `${salt ?? ""}:${dataset.fileName}:${dataset.columns.map((c) => `${c.name}:${c.type}`).join(",")}:${dataset.rows.length}:${JSON.stringify(dataset.rows.slice(0, 5))}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = (Math.imul(33, h) ^ str.charCodeAt(i)) >>> 0;
  return `h${h.toString(36)}_${dataset.rows.length}_${dataset.columns.length}`;
}

export async function hashExportPrefs(
  prefs: ExportPreferences,
): Promise<string> {
  const canon = JSON.stringify(prefs, Object.keys(prefs).sort());
  const hex = await hashString(canon);
  return hex.slice(0, 16);
}

export function hashExportPrefsSync(prefs: ExportPreferences): string {
  const canon = JSON.stringify(prefs, Object.keys(prefs).sort());
  let h = 5381;
  for (let i = 0; i < canon.length; i++)
    h = (Math.imul(33, h) ^ canon.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function composeExportHash(
  datasetHash: string,
  prefsHash: string,
): string {
  return `${datasetHash}__${prefsHash}`;
}
