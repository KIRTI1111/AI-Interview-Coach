import "server-only";

import type { FireworksProviderConfig } from "@/lib/ai/config";
import type { AIProvider, ProviderHealth, StreamChatRequest } from "@/lib/ai/types";

export class FireworksProvider implements AIProvider {
  readonly name = "fireworks";
  readonly model: string;

  constructor(private readonly config: FireworksProviderConfig) {
    this.model = config.model;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async health(signal?: AbortSignal): Promise<ProviderHealth> {
    const response = await fetch(`${this.config.baseUrl}/models`, {
      headers: this.headers(),
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("The Fireworks AI health check failed.");
    const result = await response.json() as { data?: Array<{ id?: string }> };
    const available = result.data?.some((entry) => entry.id === this.model) ?? true;
    return { connected: true, available, model: this.model, provider: this.name };
  }

  async streamChat(request: StreamChatRequest) {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      cache: "no-store",
      signal: request.signal,
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        stream: true,
        temperature: request.temperature,
        max_tokens: 2_000,
      }),
    });
    if (!response.ok || !response.body) throw new Error("Fireworks AI could not start a response.");
    return parseOpenAIStream(response.body);
  }
}

function parseOpenAIStream(body: ReadableStream<Uint8Array>) {
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
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            const event = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }>; error?: { message?: string } };
            if (event.error) throw new Error("Fireworks AI stopped generation.");
            const token = event.choices?.[0]?.delta?.content;
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
