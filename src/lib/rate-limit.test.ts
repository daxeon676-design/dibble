import { describe, expect, it } from "vitest";

import { __resetRateLimitBucketsForTests, checkRateLimit } from "@/lib/rate-limit";

describe("rate-limit", () => {
  it("allows requests until limit is reached", () => {
    __resetRateLimitBucketsForTests();
    const request = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const first = checkRateLimit(request, { scope: "test", limit: 2, windowMs: 60_000 });
    const second = checkRateLimit(request, { scope: "test", limit: 2, windowMs: 60_000 });
    const third = checkRateLimit(request, { scope: "test", limit: 2, windowMs: 60_000 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
  });

  it("isolates counts by custom key", () => {
    __resetRateLimitBucketsForTests();
    const request = new Request("http://localhost/api/test");

    const a1 = checkRateLimit(request, { scope: "test", limit: 1, windowMs: 60_000, key: "user:a" });
    const a2 = checkRateLimit(request, { scope: "test", limit: 1, windowMs: 60_000, key: "user:a" });
    const b1 = checkRateLimit(request, { scope: "test", limit: 1, windowMs: 60_000, key: "user:b" });

    expect(a1.ok).toBe(true);
    expect(a2.ok).toBe(false);
    expect(b1.ok).toBe(true);
  });
});
