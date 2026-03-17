import { describe, expect, it } from "vitest";

import { evaluateOpsAlerts } from "@/lib/ops-alerts";

describe("evaluateOpsAlerts", () => {
  it("returns info when all metrics are healthy", () => {
    const result = evaluateOpsAlerts(
      {
        paymentFailed: 0,
        paymentSucceeded: 25,
        webhookFailed: 0,
        webhookStaleProcessing: 0,
        stalePendingOrders: 0,
        pendingPayoutCount: 0,
        pendingPayoutTotalCents: 0,
        pendingWithoutConnect: 0,
      },
      {
        paymentFailureRateWarn: 0.08,
        paymentFailureRateCritical: 0.15,
        webhookFailedWarn: 5,
        webhookFailedCritical: 15,
        webhookStaleWarn: 1,
        webhookStaleCritical: 4,
        stalePendingOrdersWarn: 3,
        stalePendingOrdersCritical: 8,
        pendingPayoutCountWarn: 20,
        pendingPayoutCountCritical: 50,
        pendingPayoutTotalWarnCents: 250000,
        pendingPayoutTotalCriticalCents: 750000,
        pendingWithoutConnectWarn: 5,
        pendingWithoutConnectCritical: 20,
      },
    );

    expect(result.highestSeverity).toBe("info");
    expect(result.alerts[0]?.id).toBe("all-clear");
  });

  it("returns critical when critical thresholds are exceeded", () => {
    const result = evaluateOpsAlerts(
      {
        paymentFailed: 10,
        paymentSucceeded: 20,
        webhookFailed: 30,
        webhookStaleProcessing: 5,
        stalePendingOrders: 12,
        pendingPayoutCount: 55,
        pendingPayoutTotalCents: 900000,
        pendingWithoutConnect: 25,
      },
      {
        paymentFailureRateWarn: 0.08,
        paymentFailureRateCritical: 0.15,
        webhookFailedWarn: 5,
        webhookFailedCritical: 15,
        webhookStaleWarn: 1,
        webhookStaleCritical: 4,
        stalePendingOrdersWarn: 3,
        stalePendingOrdersCritical: 8,
        pendingPayoutCountWarn: 20,
        pendingPayoutCountCritical: 50,
        pendingPayoutTotalWarnCents: 250000,
        pendingPayoutTotalCriticalCents: 750000,
        pendingWithoutConnectWarn: 5,
        pendingWithoutConnectCritical: 20,
      },
    );

    expect(result.highestSeverity).toBe("critical");
    expect(result.alerts.some((alert) => alert.severity === "critical")).toBe(true);
  });
});
