import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "@/lib/ai/ollama-provider";

afterEach(() => vi.unstubAllGlobals());

const config = {
  provider: "ollama" as const,
  baseUrl: "https://ollama.example.com",
  model: "test-model",
  apiKey: "test-key",
};

describe("Ollama provider adapter", () => {
  it("checks model health with server-only authentication", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ name: "test-model", model: "test-model" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OllamaProvider(config);
    await expect(provider.health()).resolves.toEqual({ connected: true, available: true, model: "test-model", provider: "ollama" });
    expect(fetchMock).toHaveBeenCalledWith("https://ollama.example.com/api/tags", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-key" }) }));
  });

  it("normalizes Ollama NDJSON into a plain text stream", async () => {
    const ndjson = [
      JSON.stringify({ message: { content: "Hello " } }),
      JSON.stringify({ message: { content: "world" }, done: true }),
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(ndjson, { status: 200 })));
    const provider = new OllamaProvider(config);
    const stream = await provider.streamChat({
      messages: [{ role: "user", content: "Say hello" }],
      temperature: 0.2,
      signal: new AbortController().signal,
    });
    await expect(new Response(stream).text()).resolves.toBe("Hello world");
  });
});
