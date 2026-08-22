import { useDataStore } from "@/store/useDataStore";
import type { Dataset, DataOperationStepConfig } from "@/types";

/**
 * Executes a single data operation step on a given dataset.
 * Currently uses mock/skeleton implementations for complex joins,
 * to be filled out with full SheetJS/Custom logic later.
 */
function executeStep(
  dataset: Dataset,
  config: DataOperationStepConfig,
): Dataset {
  // 04: gate mock ops in prod — visible mocks only in DEV
  if (
    !import.meta.env.DEV &&
    (config.type === "group" ||
      config.type === "merge" ||
      config.type === "append" ||
      config.type === "pivot" ||
      config.type === "unpivot")
  ) {
    throw new Error(
      `Mock operation "${config.type}" disabled in production — use DEV for preview`,
    );
  }
  switch (config.type) {
    case "rename": {
      const { column, newName } = config;
      const newColumns = dataset.columns.map((c) =>
        c.name === column ? { ...c, name: newName } : c,
      );
      const newRows = dataset.rows.map((row) => {
        const newRow = { ...row };
        if (column in newRow) {
          newRow[newName] = newRow[column];
          delete newRow[column];
        }
        return newRow;
      });
      return { ...dataset, columns: newColumns, rows: newRows };
    }
    case "drop": {
      const { column } = config;
      const newColumns = dataset.columns.filter((c) => c.name !== column);
      const newRows = dataset.rows.map((row) => {
        const newRow = { ...row };
        delete newRow[column];
        return newRow;
      });
      return { ...dataset, columns: newColumns, rows: newRows };
    }
    case "changeType": {
      const { column, newType } = config;
      const newColumns = dataset.columns.map((c) =>
        c.name === column ? { ...c, type: newType } : c,
      );
      return { ...dataset, columns: newColumns };
    }
    case "group": {
      // Visible mock
      const newColumns = [
        ...dataset.columns,
        {
          name: "Mock_Group_Count",
          type: "numeric" as const,
          detectedType: "numeric" as const,
        },
      ];
      const newRows = dataset.rows.map((r) => ({
        ...r,
        Mock_Group_Count: Math.floor(Math.random() * 10) + 1,
      }));
      return { ...dataset, columns: newColumns, rows: newRows };
    }
    case "merge": {
      // Visible mock
      const newColumns = [
        ...dataset.columns,
        {
          name: "Mock_Merged_Data",
          type: "categorical" as const,
          detectedType: "categorical" as const,
        },
      ];
      const newRows = dataset.rows.map((r) => ({
        ...r,
        Mock_Merged_Data: "Joined",
      }));
      return { ...dataset, columns: newColumns, rows: newRows };
    }
    case "append": {
      // Visible mock
      const newRows = [
        ...dataset.rows,
        ...dataset.rows
          .slice(0, 5)
          .map((r) => ({ ...r, _id: crypto.randomUUID() })),
      ];
      return { ...dataset, rows: newRows };
    }
    case "pivot": {
      // Visible mock
      const newColumns = [
        ...dataset.columns,
        {
          name: "Mock_Pivoted_A",
          type: "numeric" as const,
          detectedType: "numeric" as const,
        },
        {
          name: "Mock_Pivoted_B",
          type: "numeric" as const,
          detectedType: "numeric" as const,
        },
      ];
      const newRows = dataset.rows.map((r) => ({
        ...r,
        Mock_Pivoted_A: 1,
        Mock_Pivoted_B: 2,
      }));
      return { ...dataset, columns: newColumns, rows: newRows };
    }
    case "unpivot": {
      // Visible mock
      const newColumns = [
        ...dataset.columns,
        {
          name: "Variable",
          type: "categorical" as const,
          detectedType: "categorical" as const,
        },
        {
          name: "Value",
          type: "numeric" as const,
          detectedType: "numeric" as const,
        },
      ];
      const newRows = dataset.rows.map((r) => ({
        ...r,
        Variable: "Metric_1",
        Value: 100,
      }));
      return { ...dataset, columns: newColumns, rows: newRows };
    }
    default:
      return dataset;
  }
}

export async function loadRawByHash(hash: string): Promise<Dataset | null> {
  try {
    const { getCacheService } = await import("@/lib/CacheService");
    return await getCacheService().getDataset(hash);
  } catch {
    return null;
  }
}

export async function recomputeStep(
  predecessor: Dataset,
  config: DataOperationStepConfig,
): Promise<Dataset> {
  return executeStep(predecessor, config);
}

/**
 * Evaluates the applied steps chronologically, using memoized results from the
 * store's `stepCache` / `stepCacheHashes` whenever possible to avoid full replays.
 * Uses hash chain: predecessor hash lazy load, not full replay from raw each time.
 */
export async function computePreviewData(): Promise<Dataset | null> {
  const store = useDataStore.getState();
  let raw = store.raw;
  if (!raw && store.rawHash) {
    raw = await loadRawByHash(store.rawHash);
    if (raw)
      useDataStore.setState({ raw } as unknown as Partial<
        ReturnType<typeof useDataStore.getState>
      >);
  }
  if (!raw) {
    const fallback = store.preview;
    if (!fallback) return null;
    raw = fallback;
  }
  const steps = store.appliedSteps;
  if (steps.length === 0) return raw;
  let currentDataset = raw;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const cached = store.stepCache.get(step.id);
    if (cached) {
      currentDataset = cached;
      continue;
    }
    const hashed = await store.getStepDataset(step.id);
    if (hashed) {
      currentDataset = hashed;
      continue;
    }
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      currentDataset = executeStep(currentDataset, step.config);
      store.setStepCache(step.id, currentDataset);
    } catch (err) {
      throw new Error(
        `Failed at step "${step.description}": ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }
  return currentDataset;
}
