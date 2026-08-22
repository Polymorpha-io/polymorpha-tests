import { useRagStore } from "@/store/useRagStore";
import { useDataStore } from "@/store/useDataStore";

export type RecommendStage = "preview" | "process" | "analyse" | "export";

// Budget ~800 chars per slice (compact JSON) — keeps worker prompt under token limit
// and avoids mid-object truncation of full profile (was slice(0,3500)).
function compactPerColumn(
  cols: Array<Record<string, unknown>> | null | undefined,
  limit: number,
  fields: string[],
): unknown[] | null {
  if (!cols || !Array.isArray(cols)) return null;
  return cols.slice(0, limit).map((c) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) if (f in c) out[f] = c[f];
    // keep topK tiny
    if (Array.isArray((out as Record<string, unknown>).topK)) {
      (out as Record<string, unknown>).topK = (
        (out as Record<string, unknown>).topK as unknown[]
      ).slice(0, 3);
    }
    return out;
  });
}

function buildRagSliceForStage(stage: RecommendStage): Record<string, unknown> {
  const { profile } = useRagStore.getState();
  // Keep objective in slice for debug but worker also gets top-level objective (objective-first)
  const slice: Record<string, unknown> = {};

  // Minimal common: dataset always useful (rows/cols/type counts)
  if (profile.dataset) slice.dataset = profile.dataset;

  if (stage === "preview") {
    slice.perColumn = compactPerColumn(
      profile.perColumn as unknown as Array<Record<string, unknown>>,
      3,
      [
        "name",
        "type",
        "detectedType",
        "unique",
        "missing",
        "missingPct",
        "mean",
        "median",
        "skewness",
        "topK",
      ],
    );
    if (profile.missing?.highMissingCols)
      slice.highMissingCols = profile.missing.highMissingCols.slice(0, 6);
    if (profile.missing?.perColumn)
      slice.missingPerColumn = profile.missing.perColumn.slice(0, 4);
  } else if (stage === "process") {
    if (profile.missing) slice.missing = profile.missing;
    if (profile.duplicate) slice.duplicate = profile.duplicate;
    if (profile.quality) slice.quality = profile.quality;
    // keep perColumn minimal for process (type validation)
    slice.perColumn = compactPerColumn(
      profile.perColumn as unknown as Array<Record<string, unknown>>,
      4,
      ["name", "type", "missing", "missingPct", "unique"],
    );
  } else if (stage === "analyse") {
    slice.perColumn = compactPerColumn(
      profile.perColumn as unknown as Array<Record<string, unknown>>,
      8,
      [
        "name",
        "type",
        "detectedType",
        "unique",
        "missingPct",
        "mean",
        "median",
        "std",
        "min",
        "max",
        "skewness",
        "kurtosis",
        "q1",
        "q3",
      ],
    );
    if (profile.dataset?.columnCountByType)
      slice.columnCountByType = profile.dataset.columnCountByType;
    if (profile.missing?.highMissingCols)
      slice.highMissingCols = profile.missing.highMissingCols.slice(0, 6);
  } else if (stage === "export") {
    slice.perColumn = compactPerColumn(
      profile.perColumn as unknown as Array<Record<string, unknown>>,
      6,
      ["name", "type", "mean", "median", "unique", "missingPct"],
    );
    if (profile.duplicate)
      slice.duplicate = {
        duplicateRows: profile.duplicate.duplicateRows,
        duplicatePct: profile.duplicate.duplicatePct,
      };
  }

  // Strip nulls to keep JSON small
  for (const k of Object.keys(slice)) if (slice[k] == null) delete slice[k];
  return slice;
}

/** @deprecated use buildRagSliceForStage — kept for debug, exported to satisfy noUnusedLocals */
export function buildRagSlice(): Record<string, unknown> {
  const { profile } = useRagStore.getState();
  const { objective } = useDataStore.getState();
  return {
    objective: objective ?? "(no objective set)",
    profile,
  };
}

export async function recommendStageStreaming(
  stage: RecommendStage,
  onToken: (tok: string) => void,
  onDone: (full: string) => void,
  onError: (err: Error) => void,
): Promise<void> {
  const ragSlice = buildRagSliceForStage(stage);
  const objective = useDataStore.getState().objective ?? "";
  const model = "openai/gpt-oss-20b";

  try {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stageLevel: stage,
        objective,
        ragSlice,
        model,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "Unknown error");
      throw new Error(`Recommend API error (${res.status}): ${txt}`);
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data: ")) continue;
        const j = t.slice(6);
        if (j === "[DONE]") continue;
        try {
          const p = JSON.parse(j);
          const tok = p.choices?.[0]?.delta?.content || "";
          if (tok) {
            full += tok;
            onToken(tok);
          }
        } catch {
          // ignore
        }
      }
    }
    onDone(full);
  } catch (e) {
    onError(e instanceof Error ? e : new Error(String(e)));
  }
}
