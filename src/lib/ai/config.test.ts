import { afterEach, describe, expect, it, vi } from "vitest";
import { getAIConfig } from "@/lib/ai/config";

afterEach(() => vi.unstubAllEnvs());

describe("AI provider configuration", () => {
  it("defaults to local Ollama", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_MODEL", "");
    expect(getAIConfig()).toMatchObject({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.2:latest",
    });
  });

  it("accepts an authenticated HTTPS remote provider", () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("AI_BASE_URL", "https://ollama.example.com/");
    vi.stubEnv("AI_MODEL", "remote-model");
    vi.stubEnv("AI_API_KEY", "secret-key");
    expect(getAIConfig()).toEqual({
      provider: "ollama",
      baseUrl: "https://ollama.example.com",
      model: "remote-model",
      apiKey: "secret-key",
    });
  });

  it("configures Fireworks with a provider-specific server-only key", () => {
    vi.stubEnv("AI_PROVIDER", "fireworks");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_MODEL", "accounts/fireworks/models/test-model");
    vi.stubEnv("FIREWORKS_API_KEY", "secret-key");
    expect(getAIConfig()).toEqual({
      provider: "fireworks",
      baseUrl: "https://api.fireworks.ai/inference/v1",
      model: "accounts/fireworks/models/test-model",
      apiKey: "secret-key",
    });
  });

  it("requires a Fireworks key and HTTPS endpoint", () => {
    vi.stubEnv("AI_PROVIDER", "fireworks");
    vi.stubEnv("FIREWORKS_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    expect(() => getAIConfig()).toThrow("FIREWORKS_API_KEY");
    vi.stubEnv("FIREWORKS_API_KEY", "secret-key");
    vi.stubEnv("AI_BASE_URL", "http://api.fireworks.ai/inference/v1");
    expect(() => getAIConfig()).toThrow("HTTPS");
  });

  it("rejects unsupported providers and unsafe protocols", () => {
    vi.stubEnv("AI_PROVIDER", "unknown");
    expect(() => getAIConfig()).toThrow("Unsupported AI provider");
    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("AI_BASE_URL", "file:///models");
    expect(() => getAIConfig()).toThrow("HTTP or HTTPS");
  });

  it("rejects a local Ollama URL on Vercel", () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("AI_BASE_URL", "http://127.0.0.1:11434");
    vi.stubEnv("VERCEL", "1");
    expect(() => getAIConfig()).toThrow("hosted AI provider");
  });

  it("requires server-only authentication for Ollama Cloud", () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("AI_BASE_URL", "https://ollama.com");
    vi.stubEnv("AI_API_KEY", "");
    expect(() => getAIConfig()).toThrow("AI_API_KEY");
  });
});
