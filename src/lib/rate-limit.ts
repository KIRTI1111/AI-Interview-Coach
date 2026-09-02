import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitScope = "chat" | "document" | "status";

type LimitConfig = {
  limit: number;
  windowMs: number;
  message: string;
};

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const configs: Record<RateLimitScope, LimitConfig> = {
  chat: { limit: 12, windowMs: 60_000, message: "You have sent several questions quickly. Please wait before asking another." },
  document: { limit: 20, windowMs: 60_000, message: "You have uploaded several documents quickly. Please wait before trying again." },
  status: { limit: 60, windowMs: 60_000, message: "Too many connection checks. Please wait a moment and try again." },
};

const memoryWindows = new Map<string, { count: number; reset: number }>();
const redisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.trim();
const redisToken = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)?.trim();
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const distributedLimiters = redis
  ? Object.fromEntries(
      Object.entries(configs).map(([scope, config]) => [
        scope,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(config.limit, `${config.windowMs} ms`),
          prefix: `ai-interview-coach:${scope}`,
          timeout: 1_500,
        }),
      ]),
    ) as Record<RateLimitScope, Ratelimit>
  : null;

export async function enforceRateLimit(request: Request, scope: RateLimitScope, userId?: string): Promise<Response | null> {
  const identifier = userId ? privateIdentifier(`user:${userId}`) : privateClientIdentifier(request);
  const result = distributedLimiters
    ? await distributedLimiters[scope].limit(identifier)
    : limitInMemory(`${scope}:${identifier}`, configs[scope]);

  if (result.success) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000));
  return Response.json(
    { error: `${configs[scope].message} Try again in ${retryAfterSeconds} seconds.`, retryAfterSeconds },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
        "X-Content-Type-Options": "nosniff",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
        "X-RateLimit-Reset": String(Math.ceil(result.reset / 1_000)),
      },
    },
  );
}

export function privateClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "local";
  const client = forwarded.split(",")[0]?.trim() || "local";
  return privateIdentifier(`client:${client}`);
}

function privateIdentifier(value: string): string {
  const salt = process.env.RATE_LIMIT_ID_SALT?.trim() || process.env.CLERK_SECRET_KEY?.trim() || "local-development-only";
  return createHmac("sha256", salt).update(value).digest("hex");
}

export function limitInMemory(key: string, config: LimitConfig, now = Date.now()): LimitResult {
  const current = memoryWindows.get(key);
  const window = !current || current.reset <= now ? { count: 0, reset: now + config.windowMs } : current;
  window.count += 1;
  memoryWindows.set(key, window);

  if (memoryWindows.size > 5_000) {
    for (const [storedKey, value] of memoryWindows) if (value.reset <= now) memoryWindows.delete(storedKey);
  }

  return {
    success: window.count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - window.count),
    reset: window.reset,
  };
}
