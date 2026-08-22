/**
 * G24: Reuses EmbeddingService (singleton, batch dedup, IDB cache, model Xenova/all-MiniLM-L6-v2) and KnowledgeService (hybrid structured+semantic) — no new vector DB; LibraryService kept as legacy fallback for one release per plan.
 */
import type { GroqModel, IStellaMessage } from "@/stella/types";
import { DEFAULT_GROQ_MODEL } from "@/stella/types";
import { Embedder } from "./Embedder";
import { LibraryService } from "@/stella/library/LibraryService";
import { knowledgeService } from "@/knowledge/KnowledgeService";
import { notebookRepository } from "@/notebook/NotebookRepository";
import { notebookContextBuilder } from "@/notebook/NotebookContextBuilder";

// Stella stays Stella — now served via opencode API (local worker, no Grok/Ollama)
// The worker at /api/stella/chat streams SSE like Groq, so the client parser stays identical.
const STELLA_API_URL = "/api/stella/chat";

const SYSTEM_PROMPT = [
  "You are Stella, a helpful statistics and data analysis assistant for Polymorpha.",
  "You answer questions about statistics, data cleaning, and analysis.",
  "Keep answers concise and informative. Use plain language.",
  "When referring to statistical concepts, explain them simply.",
].join("\n");

export class BrainService {
  private embedder = new Embedder();
  private library = new LibraryService();
  private initialized = false;
  private initializedWorkspaceId: string | null = null;

  async init(workspaceId: string | null): Promise<void> {
    if (this.initialized && this.initializedWorkspaceId === workspaceId) return;
    try {
      await this.embedder.load();
    } catch {
      /* model optional */
    }
    try {
      await this.library.init(workspaceId, this.embedder);
    } catch {
      /* library optional */
    }
    this.initialized = true;
    this.initializedWorkspaceId = workspaceId;
  }

  reset(): void {
    this.initialized = false;
    this.initializedWorkspaceId = null;
    this.library = new LibraryService();
  }

  async answerStreaming(
    messages: IStellaMessage[],
    content: string,
    workspaceId: string | null,
    model: GroqModel = DEFAULT_GROQ_MODEL,
    onToken: (token: string) => void,
    onDone: (full: string) => void,
    onError: (err: Error) => void,
    context?: {
      activeCellId?: string;
      notebookId?: string;
      searchScope?: "workspace" | "all";
    },
  ): Promise<void> {
    try {
      // RAG-only: init library (dataset → perCol → missing → duplicate → quality behind load)
      await this.init(workspaceId);
      let contextStr = "";
      try {
        // Preferred: KnowledgeService (Notebook → KnowledgeStore → EmbeddingService) — thin adapter over Xenova, no custom vector DB (G24)
        // Effective workspace for guest: store already maps null → "guest", so workspaceId is never null here when notebook exists
        const effectiveWsId = workspaceId ?? "guest";
        let notebookId = context?.notebookId;
        if (!notebookId) {
          try {
            const nb = await notebookRepository.getByWorkspace(effectiveWsId);
            if (nb) notebookId = nb.id;
          } catch {}
        }
        // If we have an active cell, build rich notebook context (active + preceding + lineage)
        let notebookContextStr = "";
        if (context?.activeCellId) {
          try {
            const nbCtx = await notebookContextBuilder.build({
              workspaceId: effectiveWsId,
              notebookId,
              activeCellId: context.activeCellId,
              query: content,
            });
            if (nbCtx.activeCell) {
              notebookContextStr = [
                `Active Cell ${nbCtx.activeCell.index} [${nbCtx.activeCell.type}] status=${nbCtx.activeCell.status} title="${nbCtx.activeCell.metadata.title || ""}"`,
                `Operation: ${nbCtx.activeCell.provenance.operation ?? "—"} columns: ${nbCtx.activeCell.provenance.columns?.join(", ") ?? "—"}`,
                `Datasets: ${nbCtx.activeCell.datasetIds.join(", ") || "—"}`,
                `Outputs: ${nbCtx.activeCell.outputs.map((o) => `${o.type}:${o.metadata.title ?? ""} ${JSON.stringify(o.data).slice(0, 200)}`).join(" | ")}`,
                nbCtx.precedingCells.length
                  ? `Preceding: ${nbCtx.precedingCells.map((c) => `Cell ${c.index} ${c.type} ${c.metadata.title ?? ""}`).join(" | ")}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n");
            }
          } catch {}
        }
        const kResults = await knowledgeService.search(content, {
          workspaceId: effectiveWsId,
          notebookId,
          cellId: context?.activeCellId,
          limit: 8,
          includeSystemKnowledge: true,
          includeSuperseded: false,
        } as unknown as import("@/knowledge/types").KnowledgeSearchOptions);
        const parts: string[] = [];
        if (notebookContextStr)
          parts.push(`[notebook_context] ${notebookContextStr}`);
        if (kResults.length > 0) {
          parts.push(
            kResults
              .map(
                (r) =>
                  `[${r.record.metadata.source ?? r.record.kind}] ${r.record.text} (cell:${r.record.cellId ?? "—"})`,
              )
              .join("\n\n"),
          );
        }
        if (parts.length > 0) contextStr = parts.join("\n\n");
        // Fallback: LibraryService with federated G23 vectors (dataset representation layer) if KnowledgeStore empty
        if (!contextStr) {
          try {
            const queryEmbedding = await this.embedder.embed(content);
            const scope = context?.searchScope ?? "workspace";
            let chunks: Awaited<ReturnType<LibraryService["search"]>> = [];
            try {
              const { useAuthStore } = await import("@/store/useAuthStore");
              const uid = useAuthStore.getState().user?.uid ?? null;
              if (uid && scope) {
                chunks = await this.library.federatedSearch(queryEmbedding, {
                  uid,
                  scope,
                  workspaceId: workspaceId ?? "guest",
                });
              } else {
                chunks = await this.library.search(queryEmbedding);
              }
            } catch {
              chunks = await this.library.search(queryEmbedding);
            }
            if (chunks.length) {
              contextStr = chunks
                .map((c) => {
                  const meta = c.metadata as Record<string, unknown>;
                  const prov =
                    meta.embeddingKind === "data_representative"
                      ? ` [${meta.workspaceId as string}/${meta.datasetId as string} kind=${meta.embeddingKind as string} coverage=${meta.sampleCoverage as string}]`
                      : "";
                  return `[${c.source}] ${c.text}${prov}`;
                })
                .join("\n\n");
            }
          } catch {
            // ignore fallback errors
          }
        }
      } catch {
        // RAG retrieval optional — continue without context
      }
      const systemContent = contextStr
        ? `${SYSTEM_PROMPT}\n\nContext (RAG streaming profiles, use when relevant):\n${contextStr}`
        : SYSTEM_PROMPT;
      const stellaMessages: Array<{ role: string; content: string }> = [
        { role: "system", content: systemContent },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content },
      ];

      // Fully online via opencode API — no Grok/Ollama/Groq fallback (per request)
      const res = await fetch(STELLA_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: stellaMessages, model }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        // If opencode worker fails, surface as error — no Groq fallback
        throw new Error(`Stella API error (${res.status}): ${errText}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            let token = parsed.choices?.[0]?.delta?.content || "";
            if (token) {
              token = token.replace(/<\/?think>/g, "");
              full += token;
              onToken(token);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      onDone(full);
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
