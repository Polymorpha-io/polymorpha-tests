import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { callExecuteApi } from "@/lib/stats/api";

/** Abort identity through postJson: user cancellation must surface as the
 *  raw DOMException (so handleRun parks cells idle with no execution
 *  count), never wrapped as a generic network error. fetch is stubbed;
 *  Firebase auth resolves null (uninitialized) via getAuthToken's guard. */
describe("callExecuteApi cancellation identity", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rethrows user aborts unwrapped (same instance)", async () => {
    const abort = new DOMException("This operation was aborted.", "AbortError");
    fetchMock.mockRejectedValue(abort);
    const controller = new AbortController();
    controller.abort();
    const promise = callExecuteApi({
      language: "python",
      code: "print(1)",
      datasets: [],
      signal: controller.signal,
    });
    await expect(promise).rejects.toBe(abort);
  });

  it("still wraps non-abort failures as network errors", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    const controller = new AbortController();
    await expect(
      callExecuteApi({
        language: "python",
        code: "print(1)",
        datasets: [],
        signal: controller.signal,
      }),
    ).rejects.toThrow(/Execute API network error: boom/);
  });
});
