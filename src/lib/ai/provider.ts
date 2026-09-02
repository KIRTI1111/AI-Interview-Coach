import "server-only";

import { getAIConfig } from "@/lib/ai/config";
import { OllamaProvider } from "@/lib/ai/ollama-provider";
import { FireworksProvider } from "@/lib/ai/fireworks-provider";
import type { AIProvider } from "@/lib/ai/types";

export function getAIProvider(): AIProvider {
  const config = getAIConfig();
  switch (config.provider) {
    case "ollama":
      return new OllamaProvider(config);
    case "fireworks":
      return new FireworksProvider(config);
  }
}
