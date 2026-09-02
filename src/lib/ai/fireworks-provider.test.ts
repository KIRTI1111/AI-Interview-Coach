import { afterEach, describe, expect, it, vi } from "vitest";
import { FireworksProvider } from "@/lib/ai/fireworks-provider";

afterEach(() => vi.unstubAllGlobals());

const config = {
  provider: "fireworks" as const,
  baseUrl: "https://api.fireworks.ai/inference/v1",
  model: "accounts/fireworks/models/test-model",
  apiKey: "test-key",
};

describe("Fireworks provider adapter", () => {
  it("checks model availability without exposing its server-only key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: config.model }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new FireworksProvider(config);
    await expect(provider.health()).resolves.toEqual({ connected: true, available: true, model: config.model, provider: "fireworks" });
    expect(fetchMock).toHaveBeenCalledWith(`${config.baseUrl}/models`, expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-key" }) }));
  });

  it("normalizes OpenAI-compatible SSE into a plain text stream", async () => {
    const sse = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello " } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "world" } }] })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(sse, { status: 200 })));
    const provider = new FireworksProvider(config);
    const stream = await provider.streamChat({
      messages: [{ role: "user", content: "Say hello" }],
      temperature: 0.2,
      signal: new AbortController().signal,
    });
    await expect(new Response(stream).text()).resolves.toBe("Hello world");
  });
});
