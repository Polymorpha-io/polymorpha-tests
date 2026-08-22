import { DICTIONARY_TERMS } from "@polymorpha/business-logic";
import { Embedder } from "@/stella/brain/Embedder";
import type { LibraryResult } from "@/stella/types";

interface IndexedTerm {
  id: string;
  term: string;
  text: string;
  embedding: Float32Array;
  metadata: Record<string, unknown>;
}

const SEARCH_TOP_K = 5;

export class DictionaryLibrary {
  private indexed: IndexedTerm[] | null = null;

  async init(embedder: Embedder): Promise<void> {
    if (this.indexed) return;

    this.indexed = await Promise.all(
      DICTIONARY_TERMS.map(async (entry) => {
        const text = [
          entry.term,
          entry.definition,
          entry.concept,
          entry.quickTake,
          entry.example,
        ]
          .filter(Boolean)
          .join("\n");

        const embedding = await embedder.embed(text);

        return {
          id: entry.id,
          term: entry.term,
          text,
          embedding,
          metadata: {
            category: entry.category,
            definition: entry.definition,
          },
        };
      }),
    );
  }

  async search(queryEmbedding: Float32Array): Promise<LibraryResult[]> {
    if (!this.indexed) return [];

    const scored = this.indexed.map((entry) => ({
      source: "dictionary" as const,
      text: `${entry.term}: ${entry.metadata.definition as string}`,
      score: Embedder.cosineSimilarity(queryEmbedding, entry.embedding),
      metadata: entry.metadata,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, SEARCH_TOP_K);
  }
}
