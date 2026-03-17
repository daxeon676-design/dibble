import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SystemHealth } from "@/lib/system-health";

const mockGetSystemHealth = vi.fn();
const mockReconcileSellerPayouts = vi.fn();
const mockEvaluateOpsAlerts = vi.fn();

vi.mock("@/lib/system-health", () => ({
  getSystemHealth: mockGetSystemHealth,
}));

vi.mock("@/lib/payout-reconciliation", () => ({
  reconcileSellerPayouts: mockReconcileSellerPayouts,
}));

vi.mock("@/lib/ops-alerts", () => ({
  evaluateOpsAlerts: mockEvaluateOpsAlerts,
}));

describe("getLaunchReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when auth hardening checks are not satisfied", async () => {
    const baseHealth: SystemHealth = {
      ok: true,
      timestamp: new Date().toISOString(),
      latencyMs: 12,
      services: {
        database: { ok: true, error: null },
        stripe: { configured: true },
        reconciliationCron: { configured: true },
        auth: { nextAuthSecretConfigured: false },
        adminAccounts: { activeCount: 0 },
        adminMfa: { adminsWithoutMfa: 2 },
        alertRouting: {
          configured: false,
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastError: null,
        },
      },
    };

    mockGetSystemHealth.mockResolvedValue(baseHealth);
    mockReconcileSellerPayouts.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      summary: { scanned: 1, issuesCount: 0, stripeEnabled: true, stripeChecksPerformed: 1, pendingCount: 0 },
      issues: [],
    });
    mockEvaluateOpsAlerts.mockReturnValue({ highestSeverity: "info", alerts: [] });

    const { getLaunchReadiness } = await import("@/lib/launch-readiness");
    const result = await getLaunchReadiness();

    expect(result.readyToLaunch).toBe(false);
    expect(result.checks.find((check) => check.id === "health-auth-secret")?.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "health-admin-account")?.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "health-admin-mfa")?.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "alert-routing")?.passed).toBe(false);
  });

  it("passes when all checks are satisfied", async () => {
    const baseHealth: SystemHealth = {
      ok: true,
      timestamp: new Date().toISOString(),
      latencyMs: 10,
      services: {
        database: { ok: true, error: null },
        stripe: { configured: true },
        reconciliationCron: { configured: true },
        auth: { nextAuthSecretConfigured: true },
        adminAccounts: { activeCount: 1 },
        adminMfa: { adminsWithoutMfa: 0 },
        alertRouting: {
          configured: true,
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastError: null,
        },
      },
    };

    mockGetSystemHealth.mockResolvedValue(baseHealth);
    mockReconcileSellerPayouts.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      summary: { scanned: 10, issuesCount: 0, stripeEnabled: true, stripeChecksPerformed: 5, pendingCount: 2 },
      issues: [],
    });
    mockEvaluateOpsAlerts.mockReturnValue({ highestSeverity: "info", alerts: [{ id: "all-clear", severity: "info", message: "Healthy" }] });

    const { getLaunchReadiness } = await import("@/lib/launch-readiness");
    const result = await getLaunchReadiness();

    expect(result.readyToLaunch).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });
});