export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProviderMessage = ChatMessage | {
  role: "system";
  content: string;
};

export type ProviderHealth = {
  connected: boolean;
  available: boolean;
  model: string;
  provider: string;
};

export type StreamChatRequest = {
  messages: ProviderMessage[];
  temperature: number;
  signal: AbortSignal;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  health(signal?: AbortSignal): Promise<ProviderHealth>;
  streamChat(request: StreamChatRequest): Promise<ReadableStream<Uint8Array>>;
}
