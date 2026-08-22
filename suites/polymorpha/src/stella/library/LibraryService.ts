import { DictionaryLibrary } from "./DictionaryLibrary";
import { UserLibrary } from "./UserLibrary";
import type { Embedder } from "@/stella/brain/Embedder";
import type { LibraryResult } from "@/stella/types";

export class LibraryService {
  private dictionary = new DictionaryLibrary();
  private user = new UserLibrary();

  async init(workspaceId: string | null, embedder: Embedder): Promise<void> {
    await Promise.all([
      this.dictionary.init(embedder),
      this.user.init(workspaceId, embedder),
    ]);
  }

  async search(
    queryEmbedding: Float32Array,
    opts?: {
      uid?: string | null;
      scope?: "workspace" | "all";
      workspaceId?: string | null;
    },
  ): Promise<LibraryResult[]> {
    const [dictResults, userResults] = await Promise.all([
      this.dictionary.search(queryEmbedding),
      this.user.search(queryEmbedding, opts),
    ]);

    const combined = [...dictResults, ...userResults];
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, 10);
  }

  async federatedSearch(
    queryEmbedding: Float32Array,
    opts: {
      uid: string;
      scope: "workspace" | "all";
      workspaceId?: string | null;
    },
  ): Promise<LibraryResult[]> {
    const [dictResults, userResults] = await Promise.all([
      this.dictionary.search(queryEmbedding),
      this.user.federatedSearch(queryEmbedding, opts),
    ]);
    const combined = [...dictResults, ...userResults];
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, 10);
  }
}
