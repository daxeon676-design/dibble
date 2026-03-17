import { loadEnvConfig } from "@next/env";

import {
  __resetAuthSecurityBucketsForTests,
  clearLoginFailures,
  getLoginSecuritySnapshot,
  isLoginAllowed,
  recordLoginFailure,
} from "@/lib/auth-security";

loadEnvConfig(process.cwd());

type CheckResult = {
  name: string;
  ok: boolean;
  details?: string;
};

function pass(name: string, details?: string): CheckResult {
  console.log(`PASS: ${name}${details ? ` (${details})` : ""}`);
  return { name, ok: true, details };
}

function fail(name: string, details?: string): CheckResult {
  console.error(`FAIL: ${name}${details ? ` (${details})` : ""}`);
  return { name, ok: false, details };
}

async function checkSecurityHeaders(baseUrl: string): Promise<CheckResult[]> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`);
  const headers = res.headers;

  const expected: Array<[string, string | RegExp]> = [
    ["x-frame-options", "DENY"],
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["permissions-policy", /camera=\(\), microphone=\(\), geolocation=\(\)/],
    ["cross-origin-opener-policy", "same-origin"],
    ["cross-origin-resource-policy", "same-site"],
    ["x-dns-prefetch-control", "off"],
  ];

  const checks: CheckResult[] = [];

  for (const [header, expectedValue] of expected) {
    const value = headers.get(header);
    if (!value) {
      checks.push(fail(`Header ${header} exists`));
      continue;
    }

    if (typeof expectedValue === "string") {
      checks.push(value === expectedValue ? pass(`Header ${header} value`) : fail(`Header ${header} value`, `actual=${value}`));
    } else {
      checks.push(expectedValue.test(value) ? pass(`Header ${header} format`) : fail(`Header ${header} format`, `actual=${value}`));
    }
  }

  const hsts = headers.get("strict-transport-security");
  checks.push(hsts ? pass("Header strict-transport-security exists") : fail("Header strict-transport-security exists"));

  return checks;
}

function checkAuthLockoutBehavior(): CheckResult[] {
  __resetAuthSecurityBucketsForTests();
  const email = "security-smoke@example.com";

  const checks: CheckResult[] = [];
  checks.push(isLoginAllowed(email) ? pass("Login initially allowed") : fail("Login initially allowed"));

  for (let i = 0; i < 8; i += 1) {
    recordLoginFailure(email);
  }

  checks.push(!isLoginAllowed(email) ? pass("Login blocked after repeated failures") : fail("Login blocked after repeated failures"));

  const snapshot = getLoginSecuritySnapshot().find((entry) => entry.email === email);
  checks.push(snapshot?.blocked ? pass("Security snapshot marks account blocked") : fail("Security snapshot marks account blocked"));

  clearLoginFailures(email);
  checks.push(isLoginAllowed(email) ? pass("Login re-allowed after clearing failures") : fail("Login re-allowed after clearing failures"));

  return checks;
}

async function main() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const results: CheckResult[] = [];

  try {
    results.push(...(await checkSecurityHeaders(baseUrl)));
  } catch (error) {
    results.push(fail("Security headers check", error instanceof Error ? error.message : String(error)));
  }

  results.push(...checkAuthLockoutBehavior());

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`\nSecurity smoke failed (${failed.length}/${results.length} checks).`);
    process.exit(1);
  }

  console.log(`\nSecurity smoke passed (${results.length} checks).`);
}

void main();
