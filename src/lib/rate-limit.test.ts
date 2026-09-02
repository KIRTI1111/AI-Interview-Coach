import { describe, expect, it } from "vitest";
import { limitInMemory, privateClientIdentifier } from "@/lib/rate-limit";

describe("rate limiting", () => {
  it("allows requests up to the configured limit and then blocks", () => {
    const config = { limit: 2, windowMs: 1_000, message: "Wait." };
    expect(limitInMemory("test-limit", config, 100).success).toBe(true);
    expect(limitInMemory("test-limit", config, 200).success).toBe(true);
    expect(limitInMemory("test-limit", config, 300)).toMatchObject({ success: false, remaining: 0, reset: 1_100 });
  });

  it("starts a new window after the reset time", () => {
    const config = { limit: 1, windowMs: 1_000, message: "Wait." };
    expect(limitInMemory("test-reset", config, 100).success).toBe(true);
    expect(limitInMemory("test-reset", config, 1_100).success).toBe(true);
  });

  it("uses a stable private hash rather than returning the client address", () => {
    const request = new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" } });
    const identifier = privateClientIdentifier(request);
    expect(identifier).toHaveLength(64);
    expect(identifier).not.toContain("203.0.113.10");
    expect(privateClientIdentifier(request)).toBe(identifier);
  });
});
