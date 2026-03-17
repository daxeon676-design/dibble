export type OpsAlertSeverity = "info" | "warn" | "critical";

export type OpsSnapshot = {
  paymentFailed: number;
  paymentSucceeded: number;
  webhookFailed: number;
  webhookStaleProcessing: number;
  stalePendingOrders: number;
  pendingPayoutCount: number;
  pendingPayoutTotalCents: number;
  pendingWithoutConnect: number;
};

export type OpsAlertThresholds = {
  paymentFailureRateWarn: number;
  paymentFailureRateCritical: number;
  webhookFailedWarn: number;
  webhookFailedCritical: number;
  webhookStaleWarn: number;
  webhookStaleCritical: number;
  stalePendingOrdersWarn: number;
  stalePendingOrdersCritical: number;
  pendingPayoutCountWarn: number;
  pendingPayoutCountCritical: number;
  pendingPayoutTotalWarnCents: number;
  pendingPayoutTotalCriticalCents: number;
  pendingWithoutConnectWarn: number;
  pendingWithoutConnectCritical: number;
};

export type OpsAlert = {
  id: string;
  severity: OpsAlertSeverity;
  message: string;
  value: number;
  threshold: number;
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getOpsAlertThresholds(): OpsAlertThresholds {
  return {
    paymentFailureRateWarn: envNumber("OPS_ALERT_PAYMENT_FAILURE_RATE_WARN", 0.08),
    paymentFailureRateCritical: envNumber("OPS_ALERT_PAYMENT_FAILURE_RATE_CRITICAL", 0.15),
    webhookFailedWarn: envNumber("OPS_ALERT_WEBHOOK_FAILED_WARN", 5),
    webhookFailedCritical: envNumber("OPS_ALERT_WEBHOOK_FAILED_CRITICAL", 15),
    webhookStaleWarn: envNumber("OPS_ALERT_WEBHOOK_STALE_WARN", 1),
    webhookStaleCritical: envNumber("OPS_ALERT_WEBHOOK_STALE_CRITICAL", 4),
    stalePendingOrdersWarn: envNumber("OPS_ALERT_STALE_PENDING_ORDERS_WARN", 3),
    stalePendingOrdersCritical: envNumber("OPS_ALERT_STALE_PENDING_ORDERS_CRITICAL", 8),
    pendingPayoutCountWarn: envNumber("OPS_ALERT_PENDING_PAYOUT_COUNT_WARN", 20),
    pendingPayoutCountCritical: envNumber("OPS_ALERT_PENDING_PAYOUT_COUNT_CRITICAL", 50),
    pendingPayoutTotalWarnCents: envNumber("OPS_ALERT_PENDING_PAYOUT_TOTAL_WARN_CENTS", 250000),
    pendingPayoutTotalCriticalCents: envNumber("OPS_ALERT_PENDING_PAYOUT_TOTAL_CRITICAL_CENTS", 750000),
    pendingWithoutConnectWarn: envNumber("OPS_ALERT_PENDING_WITHOUT_CONNECT_WARN", 5),
    pendingWithoutConnectCritical: envNumber("OPS_ALERT_PENDING_WITHOUT_CONNECT_CRITICAL", 20),
  };
}

export function evaluateOpsAlerts(snapshot: OpsSnapshot, thresholds: OpsAlertThresholds = getOpsAlertThresholds()) {
  const alerts: OpsAlert[] = [];
  const paymentFailureRate = snapshot.paymentFailed / Math.max(snapshot.paymentSucceeded, 1);

  if (paymentFailureRate >= thresholds.paymentFailureRateCritical) {
    alerts.push({
      id: "payment-failure-rate",
      severity: "critical",
      message: "Payment failure rate is critically high",
      value: paymentFailureRate,
      threshold: thresholds.paymentFailureRateCritical,
    });
  } else if (paymentFailureRate >= thresholds.paymentFailureRateWarn) {
    alerts.push({
      id: "payment-failure-rate",
      severity: "warn",
      message: "Payment failure rate is above warning threshold",
      value: paymentFailureRate,
      threshold: thresholds.paymentFailureRateWarn,
    });
  }

  const simpleChecks: Array<{
    id: string;
    label: string;
    value: number;
    warn: number;
    critical: number;
  }> = [
    {
      id: "webhook-failed",
      label: "Failed webhooks",
      value: snapshot.webhookFailed,
      warn: thresholds.webhookFailedWarn,
      critical: thresholds.webhookFailedCritical,
    },
    {
      id: "webhook-stale",
      label: "Stale webhook processing events",
      value: snapshot.webhookStaleProcessing,
      warn: thresholds.webhookStaleWarn,
      critical: thresholds.webhookStaleCritical,
    },
    {
      id: "stale-pending-orders",
      label: "Stale pending orders",
      value: snapshot.stalePendingOrders,
      warn: thresholds.stalePendingOrdersWarn,
      critical: thresholds.stalePendingOrdersCritical,
    },
    {
      id: "pending-payout-count",
      label: "Pending payout count",
      value: snapshot.pendingPayoutCount,
      warn: thresholds.pendingPayoutCountWarn,
      critical: thresholds.pendingPayoutCountCritical,
    },
    {
      id: "pending-payout-total",
      label: "Pending payout total (cents)",
      value: snapshot.pendingPayoutTotalCents,
      warn: thresholds.pendingPayoutTotalWarnCents,
      critical: thresholds.pendingPayoutTotalCriticalCents,
    },
    {
      id: "pending-without-connect",
      label: "Pending payouts without Connect",
      value: snapshot.pendingWithoutConnect,
      warn: thresholds.pendingWithoutConnectWarn,
      critical: thresholds.pendingWithoutConnectCritical,
    },
  ];

  for (const check of simpleChecks) {
    if (check.value >= check.critical) {
      alerts.push({
        id: check.id,
        severity: "critical",
        message: `${check.label} is critically high`,
        value: check.value,
        threshold: check.critical,
      });
      continue;
    }

    if (check.value >= check.warn) {
      alerts.push({
        id: check.id,
        severity: "warn",
        message: `${check.label} is above warning threshold`,
        value: check.value,
        threshold: check.warn,
      });
    }
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      severity: "info",
      message: "All monitored operational metrics are within thresholds",
      value: 0,
      threshold: 0,
    });
  }

  return {
    alerts,
    highestSeverity: alerts.some((alert) => alert.severity === "critical")
      ? "critical"
      : alerts.some((alert) => alert.severity === "warn")
        ? "warn"
        : "info",
  };
}
