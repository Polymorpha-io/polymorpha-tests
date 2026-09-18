import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StellaPanel } from "@/stella/components/StellaPanel";
import { useStellaStore } from "@/stella/store";

const baseProps = {
  isOpen: true,
  isStreaming: false,
  messages: [],
  input: "",
  streamingContent: "",
  meta: null,
  onInputChange: () => {},
  onSend: () => {},
  onCancel: () => {},
  onClose: () => {},
  onClear: () => {},
  onExampleClick: () => {},
};

function resetStore() {
  useStellaStore.setState({
    isOpen: false,
    messages: [],
    streamingContent: "",
    isStreaming: false,
    openCodeAvailable: null,
    lastMeta: null,
  });
}

beforeEach(() => {
  resetStore();
  vi.unstubAllGlobals();
});

describe("StellaPanel backend row", () => {
  it("shows a down banner with the serve command when unreachable", () => {
    useStellaStore.setState({ openCodeAvailable: false });
    render(<StellaPanel {...baseProps} />);
    expect(screen.getByText(/OpenCode server not found/)).toBeInTheDocument();
    expect(screen.getByText(/opencode serve --cors/)).toBeInTheDocument();
  });

  it("shows no banner when the server is healthy", () => {
    useStellaStore.setState({ openCodeAvailable: true });
    render(<StellaPanel {...baseProps} />);
    expect(screen.queryByText(/OpenCode server not found/)).toBeNull();
  });

  it("probes the server once on open when unchecked", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ healthy: true, version: "1.18.31" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    render(<StellaPanel {...baseProps} />);
    await waitFor(() =>
      expect(useStellaStore.getState().openCodeAvailable).toBe(true),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/global/health");
  });

  it("hides the banner on hosted origins even when down (local-only feature)", () => {
    vi.stubGlobal("location", {
      hostname: "app.example.com",
      origin: "https://app.example.com",
    });
    try {
      useStellaStore.setState({ openCodeAvailable: false });
      render(<StellaPanel {...baseProps} />);
      expect(screen.queryByText(/OpenCode server not found/)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
