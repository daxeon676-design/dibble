import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetAuthSecurityBucketsForTests,
  clearLoginFailures,
  isLoginAllowed,
  recordLoginFailure,
} from "@/lib/auth-security";

describe("auth-security", () => {
  beforeEach(() => {
    __resetAuthSecurityBucketsForTests();
  });

  it("blocks login after repeated failures", () => {
    const email = "user@example.com";

    for (let i = 0; i < 8; i += 1) {
      recordLoginFailure(email);
    }

    expect(isLoginAllowed(email)).toBe(false);
  });

  it("clears lock when failures are reset after successful auth", () => {
    const email = "user@example.com";

    for (let i = 0; i < 8; i += 1) {
      recordLoginFailure(email);
    }

    expect(isLoginAllowed(email)).toBe(false);

    clearLoginFailures(email);

    expect(isLoginAllowed(email)).toBe(true);
  });
});
