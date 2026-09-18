import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { StellaPanel } from "@/stella/components/StellaPanel";

const baseProps = {
  isOpen: true,
  isStreaming: false,
  messages: [],
  input: "",
  streamingContent: "",
  onInputChange: () => {},
  onSend: () => {},
  onCancel: () => {},
  onClose: () => {},
  onClear: () => {},
  onExampleClick: () => {},
};

describe("StellaPanel transparency chip", () => {
  it("shows a cache chip for fresh cache hits", () => {
    render(
      <StellaPanel
        {...baseProps}
        meta={{
          model: "opencode-go/muse-spark-1.2-contributor",
          cacheHit: true,
          at: Date.now(),
        }}
      />,
    );
    expect(screen.getByTitle("Served from cache").textContent).toContain("⚡");
  });

  it("shows a model-suffix chip for fresh non-cache answers", () => {
    render(
      <StellaPanel
        {...baseProps}
        meta={{
          model: "opencode-go/muse-spark-1.2-contributor",
          cacheHit: false,
          at: Date.now(),
        }}
      />,
    );
    expect(
      screen.getByTitle(/muse-spark-1\.2-contributor/).textContent,
    ).toContain("muse-spark-1.2-contributor");
  });

  it("shows no chip without meta", () => {
    render(<StellaPanel {...baseProps} meta={null} />);
    expect(screen.queryByTitle("Served from cache")).toBeNull();
  });

  it("hides the chip after its freshness window", () => {
    vi.useFakeTimers();
    try {
      render(
        <StellaPanel
          {...baseProps}
          meta={{
            model: "opencode-go/muse-spark-1.2-contributor",
            cacheHit: true,
            at: Date.now(),
          }}
        />,
      );
      expect(screen.getByTitle("Served from cache")).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.queryByTitle("Served from cache")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
