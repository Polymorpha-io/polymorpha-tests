import { beforeEach, describe, expect, it, vi } from "vitest";
import { prewarmStellaEmbeddings, resetStellaPrewarm } from "@/stella/prewarm";

const embedMock = vi.hoisted(() => vi.fn());

vi.mock("@polymorpha/stella", () => ({
  embeddingService: { embed: embedMock },
}));

beforeEach(() => {
  resetStellaPrewarm();
  embedMock.mockReset();
  embedMock.mockResolvedValue(new Float32Array(8));
});

describe("prewarmStellaEmbeddings", () => {
  it("embeds once across repeated opens", () => {
    prewarmStellaEmbeddings();
    prewarmStellaEmbeddings();
    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(embedMock).toHaveBeenCalledWith("stella warmup");
  });

  it("retries after a failure", async () => {
    embedMock.mockRejectedValueOnce(new Error("wasm down"));
    prewarmStellaEmbeddings();
    await new Promise((r) => setTimeout(r, 0));
    prewarmStellaEmbeddings();
    expect(embedMock).toHaveBeenCalledTimes(2);
  });
});
