import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useDataStore } from "@/store/useDataStore";
import type { Dataset } from "@/types";

/**
 * Full-chain regression for "Fix with AI applies into the cell" — the
 * notebook-pane suite mocks `useStellaStore.sendMessage`, so the REAL
 * store behavior (isStreaming phases, message appends, onDone) had never
 * been exercised against the pane's auto-apply effect. Here only the
 * @polymorpha/stella transport is faked: the click → real sendMessage →
 * reply → auto-apply → re-run chain runs for real.
 */

// Monaco never loads under jsdom: plain stub (same contract as the
// notebook-pane suite — value in, onChange out).
vi.mock("@/components/DataPreview/CellEditorLazy", () => ({
  LazyCellEditor: ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (next: string) => void;
    label: string;
  }) => (
    <textarea
      data-testid="cell-editor-stub"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/lib/stats/api", () => ({
  callExecuteApi: vi.fn(),
  getDownloadUrlCached: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

const FULL_REPLY =
  "```python\nprint(df.head().to_string())\ndf.info()\n```\nChanged: wrapped head, called info bare.";

// Fake the TRANSPORT only: the REAL useStellaStore.sendMessage runs (its
// isStreaming phases + message appends), backed by a canned reply.
vi.mock("@polymorpha/stella", async (importOriginal) => {
  const actual = await importOriginal<
    Record<string, unknown> & typeof import("@polymorpha/stella")
  >();
  class FakeService {
    setOpenCodeTarget() {}
    setContext() {}
    async sendMessage(
      _messages: unknown,
      _content: string,
      _model: unknown,
      callbacks: {
        onToken: (t: string) => void;
        onDone: (full: string) => void;
        onError: (e: Error) => void;
      },
    ) {
      await new Promise((r) => setTimeout(r, 10));
      callbacks.onToken(FULL_REPLY);
      callbacks.onDone(FULL_REPLY);
    }
  }
  return { ...actual, StellaService: FakeService };
});

import { NotebookPane } from "@/components/NotebookWorkbench/NotebookPane";
import { useStellaStore } from "@/stella/store";
import { callExecuteApi } from "@/lib/stats/api";
import { toast } from "sonner";
import { extractFirstCodeBlock, fixMatchesCell } from "@/lib/jupyterCell";

function dataset(): Dataset {
  return {
    fileName: "df.csv",
    uploadedAt: new Date(0),
    columns: [
      {
        name: "c0",
        type: "unknown" as const,
        detectedType: "unknown" as const,
      },
    ],
    rows: [{ c0: 1 }],
  };
}

function seed() {
  localStorage.clear();
  useDataStore.setState({
    raw: dataset(),
    rawHash: "test-hash",
    totalRowCount: 1,
    storagePath: "users/u1/df.csv",
    uploadId: "up1",
    workspaceId: "ws1",
    kernelVars: [],
    appliedSteps: [],
    pastSteps: [],
    futureSteps: [],
    computedHead: null,
    cleaned: null,
    combineExtras: [],
    historyEpoch: 0,
  } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
  useStellaStore.setState({
    isOpen: true,
    messages: [],
    isStreaming: false,
    streamingContent: "",
    sessions: [],
    currentSessionId: null,
    activeCellId: null,
  } as unknown as Partial<ReturnType<typeof useStellaStore.getState>>);
}

beforeEach(() => {
  seed();
  vi.mocked(callExecuteApi).mockResolvedValue({
    stdout: "",
    stderr: "TypeError: unhashable type",
    exitCode: 1,
    durationMs: 2,
  });
});

describe("Fix with AI full chain (real store, fake transport)", () => {
  it("click Fix with AI → real sendMessage → reply auto-applies into the cell", async () => {
    vi.mocked(toast.success).mockClear();
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    const editor = () =>
      screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement;
    fireEvent.change(editor(), {
      target: { value: "df.head()\nprint(df.info)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Fix with AI" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
    // Full chain: prompt → store send (isStreaming true) → transport reply
    // → onDone append → auto-apply effect → cell rewritten + re-run.
    await waitFor(
      () =>
        expect(editor().value).toBe("print(df.head().to_string())\ndf.info()"),
      { timeout: 3000 },
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      expect.stringContaining("re-running"),
      expect.anything(),
    );
  });
});

describe("reply parsing robustness (real-model shapes, probed live)", () => {
  // Shapes seen from the live OpenCode backend and common model quirks.
  it("extracts fenced fixes across formatting variants", () => {
    expect(
      extractFirstCodeBlock(
        "Fix:\n```python\nprint(df.head())\n```\nChanged: wrapped.",
      ),
    ).toBe("print(df.head())");
    expect(extractFirstCodeBlock("```\nprint(x)\n```")).toBe("print(x)");
    // Capitalized language tag (happens in the wild).
    expect(extractFirstCodeBlock("```Python\nprint(x)\n```")).toBe("print(x)");
    // Markdown nesting: 4-backtick outer wrapper around the code fence.
    expect(
      extractFirstCodeBlock("````markdown\n```python\nprint(x)\n```\n````"),
    ).toBe("print(x)");
    // CRLF line endings.
    expect(extractFirstCodeBlock("```python\r\nprint(x)\r\n```")).toBe(
      "print(x)",
    );
    // Prose without fences never extracts (G19: no invented code).
    expect(extractFirstCodeBlock("Use `x = 1` instead.")).toBeNull();
    // Degenerate fences never reach a cell.
    expect(extractFirstCodeBlock("```python\n```")).toBeNull();
    expect(extractFirstCodeBlock("```python\n# comment only\n```")).toBeNull();
  });

  it("relevance gate blocks parroted prompt boilerplate, passes real fixes", () => {
    expect(fixMatchesCell("df.info()", "print(1)")).toBe(false);
    expect(fixMatchesCell("print(df.head())", "df.head()")).toBe(true);
    expect(
      fixMatchesCell("data = load()\nprint(data)", "df = load()\nprint(df)"),
    ).toBe(true);
  });
});
