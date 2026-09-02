import type { ChatMessage } from "@/lib/ai/types";
import { getAIProvider } from "@/lib/ai/provider";
import { MAX_ASSISTANT_MESSAGE_CHARS, validMessages } from "@/lib/chat-validation";
import { buildSystemPrompt } from "@/lib/coach-prompts";
import { enforceRateLimit } from "@/lib/rate-limit";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 350_000;
const MAX_CONTEXT_CHARS = 200_000;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

type ChatBody = {
  coach?: "resume" | "skills";
  resumeText?: string;
  jobDescriptionText?: string;
  messages?: ChatMessage[];
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to use the interview coach." }, { status: 401, headers });
  const rateLimitResponse = await enforceRateLimit(request, "chat", userId);
  if (rateLimitResponse) return rateLimitResponse;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return Response.json({ error: "The request is too large." }, { status: 413, headers });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Expected a JSON chat request." }, { status: 415, headers });
  }

  try {
    const body = (await request.json()) as ChatBody;
    if (body.coach !== "resume" && body.coach !== "skills") return Response.json({ error: "Choose a valid coach." }, { status: 400, headers });
    if (typeof body.resumeText !== "string" || typeof body.jobDescriptionText !== "string") return Response.json({ error: "Resume and job-description context are required." }, { status: 400, headers });
    const resume = body.resumeText.trim();
    const job = body.jobDescriptionText.trim();
    if (!resume || job.length < 50 || resume.length + job.length > MAX_CONTEXT_CHARS) return Response.json({ error: "The document context is missing or too large." }, { status: 400, headers });
    if (!validMessages(body.messages) || body.messages.at(-1)?.role !== "user") return Response.json({ error: "The conversation is invalid." }, { status: 400, headers });

    const provider = getAIProvider();
    const upstreamController = new AbortController();
    request.signal.addEventListener("abort", () => upstreamController.abort(), { once: true });
    const timeout = setTimeout(() => upstreamController.abort(), 90_000);
    let providerStream: ReadableStream<Uint8Array>;
    try {
      providerStream = await provider.streamChat({
        signal: upstreamController.signal,
        messages: [{ role: "system", content: buildSystemPrompt(body.coach, resume, job) }, ...body.messages],
        temperature: body.coach === "resume" ? 0.2 : 0.5,
      });
    } catch (error) {
      clearTimeout(timeout);
      const timedOut = error instanceof Error && error.name === "AbortError";
      return Response.json({ error: timedOut ? "The AI provider took too long to start responding." : "The AI provider is not reachable." }, { status: timedOut ? 504 : 503, headers });
    }

    const stream = limitProviderStream(providerStream, upstreamController, timeout);
    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Accel-Buffering": "no",
        "X-AI-Model": provider.model,
        "X-AI-Provider": provider.name,
      },
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "AbortError";
    return Response.json(
      { error: timeout ? "The AI provider took too long to respond." : "The configured AI provider could not answer." },
      { status: timeout ? 504 : 503, headers },
    );
  }
}

function limitProviderStream(body: ReadableStream<Uint8Array>, upstreamController: AbortController, timeout: ReturnType<typeof setTimeout>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = body.getReader();
      let emitted = 0;
      try {
        while (true) {
          const { done, value = new Uint8Array() } = await reader.read();
          const token = decoder.decode(value, { stream: !done });
          const remaining = MAX_ASSISTANT_MESSAGE_CHARS - emitted;
          const safeToken = token.slice(0, Math.max(0, remaining));
          if (safeToken) controller.enqueue(encoder.encode(safeToken));
          emitted += safeToken.length;
          if (safeToken.length < token.length || emitted >= MAX_ASSISTANT_MESSAGE_CHARS) {
            controller.enqueue(encoder.encode("\n\n[Response shortened to keep the conversation within its safe size limit.]"));
            upstreamController.abort();
          }
          if (done || emitted >= MAX_ASSISTANT_MESSAGE_CHARS) break;
        }
        controller.close();
      } catch {
        if (emitted > 0) {
          controller.enqueue(encoder.encode("\n\n[Response interrupted. Please try again.]"));
          controller.close();
        } else {
          controller.error(new Error("The local model stopped before producing an answer."));
        }
      } finally {
        clearTimeout(timeout);
        await reader.cancel().catch(() => undefined);
      }
    },
    cancel() {
      clearTimeout(timeout);
      upstreamController.abort();
      void reader?.cancel();
    },
  });
}
