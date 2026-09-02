import "server-only";

import type { AIProvider, ProviderHealth, StreamChatRequest } from "@/lib/ai/types";
import type { OllamaProviderConfig } from "@/lib/ai/config";

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  readonly model: string;

  constructor(private readonly config: OllamaProviderConfig) {
    this.model = config.model;
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
    };
  }

  async health(signal?: AbortSignal): Promise<ProviderHealth> {
    const response = await fetch(`${this.config.baseUrl}/api/tags`, {
      headers: this.headers(),
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("The AI provider health check failed.");
    const result = await response.json() as { models?: Array<{ name: string; model: string }> };
    const available = result.models?.some((entry) => entry.name === this.model || entry.model === this.model) ?? false;
    return { connected: true, available, model: this.model, provider: this.name };
  }

  async streamChat(request: StreamChatRequest) {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: this.headers(),
      cache: "no-store",
      signal: request.signal,
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: request.messages,
        options: { temperature: request.temperature },
      }),
    });
    if (!response.ok || !response.body) throw new Error("The AI provider could not start a response.");
    return parseOllamaStream(response.body);
  }
}

function parseOllamaStream(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = body.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as { message?: { content?: string }; error?: string };
            if (event.error) throw new Error("The AI provider stopped generation.");
            const token = event.message?.content;
            if (token) controller.enqueue(encoder.encode(token));
          }
          if (done) break;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        await reader.cancel().catch(() => undefined);
      }
    },
    cancel() {
      void reader?.cancel();
    },
  });
}
