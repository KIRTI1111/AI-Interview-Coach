import "server-only";

export type OllamaProviderConfig = {
  provider: "ollama";
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type FireworksProviderConfig = {
  provider: "fireworks";
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type AIProviderConfig = OllamaProviderConfig | FireworksProviderConfig;

export function getAIConfig(): AIProviderConfig {
  const provider = process.env.AI_PROVIDER || "ollama";
  if (provider !== "ollama" && provider !== "fireworks") throw new Error(`Unsupported AI provider: ${provider}`);

  if (provider === "fireworks") {
    const rawUrl = process.env.AI_BASE_URL || "https://api.fireworks.ai/inference/v1";
    const url = validateRemoteUrl(rawUrl);
    const apiKey = process.env.FIREWORKS_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) throw new Error("FIREWORKS_API_KEY is required when AI_PROVIDER=fireworks.");
    return {
      provider,
      baseUrl: url.toString().replace(/\/$/, ""),
      model: process.env.AI_MODEL || "accounts/fireworks/models/glm-5p2",
      apiKey,
    };
  }

  const rawUrl = process.env.AI_BASE_URL || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("AI_BASE_URL must use HTTP or HTTPS.");
  if (process.env.VERCEL && isLoopback(url.hostname)) {
    throw new Error("AI_BASE_URL must point to a hosted AI provider when deployed on Vercel.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !isLoopback(url.hostname)) {
    throw new Error("A remote production AI provider must use HTTPS.");
  }
  const apiKey = process.env.AI_API_KEY || undefined;
  if (url.hostname === "ollama.com" && !apiKey) throw new Error("AI_API_KEY is required for the Ollama Cloud API.");

  return {
    provider,
    baseUrl: url.toString().replace(/\/$/, ""),
    model: process.env.AI_MODEL || process.env.OLLAMA_MODEL || "llama3.2:latest",
    apiKey,
  };
}

function validateRemoteUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("A hosted AI provider must use HTTPS.");
  if (isLoopback(url.hostname)) throw new Error("A hosted AI provider cannot use a loopback address.");
  return url;
}

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}
