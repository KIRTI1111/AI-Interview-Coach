import type { ChatMessage } from "@/lib/ai/types";

export const MAX_USER_MESSAGE_CHARS = 4_000;
export const MAX_ASSISTANT_MESSAGE_CHARS = 20_000;
export const MAX_HISTORY_CHARS = 60_000;
export const MAX_HISTORY_MESSAGES = 12;

export function validMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_HISTORY_MESSAGES) return false;

  let totalCharacters = 0;
  for (const [index, message] of value.entries()) {
    if (typeof message !== "object" || message === null) return false;
    if (message.role !== "user" && message.role !== "assistant") return false;
    if (typeof message.content !== "string" || !message.content.trim()) return false;

    const roleLimit = message.role === "user" ? MAX_USER_MESSAGE_CHARS : MAX_ASSISTANT_MESSAGE_CHARS;
    if (message.content.length > roleLimit) return false;
    if (index > 0 && value[index - 1]?.role === message.role) return false;

    totalCharacters += message.content.length;
    if (totalCharacters > MAX_HISTORY_CHARS) return false;
  }
  return value[0]?.role === "user";
}
