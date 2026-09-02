import { getAIProvider } from "@/lib/ai/provider";
import { enforceRateLimit } from "@/lib/rate-limit";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ connected: false, error: "Sign in to check the AI provider." }, { status: 401, headers });
  const rateLimitResponse = await enforceRateLimit(request, "status", userId);
  if (rateLimitResponse) return rateLimitResponse;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const provider = getAIProvider();
    return Response.json(await provider.health(controller.signal), { headers });
  } catch {
    return Response.json({ connected: false, error: "The configured AI provider is not reachable." }, { status: 503, headers });
  } finally {
    clearTimeout(timeout);
  }
}
