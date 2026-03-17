import { evaluateOpsAlerts } from "@/lib/ops-alerts";
import { reconcileSellerPayouts } from "@/lib/payout-reconciliation";
import { getSystemHealth } from "@/lib/system-health";

export type LaunchGateCheck = {
  id: string;
  label: string;
  passed: boolean;
  details: string;
};

export type LaunchReadiness = {
  readyToLaunch: boolean;
  generatedAt: string;
  checks: LaunchGateCheck[];
};

export async function getLaunchReadiness(): Promise<LaunchReadiness> {
  const [health, reconciliation] = await Promise.all([getSystemHealth(), reconcileSellerPayouts()]);

  const alerts = evaluateOpsAlerts({
    paymentFailed: 0,
    paymentSucceeded: 1,
    webhookFailed: 0,
    webhookStaleProcessing: 0,
    stalePendingOrders: 0,
    pendingPayoutCount: reconciliation.summary.pendingCount,
    pendingPayoutTotalCents: 0,
    pendingWithoutConnect: 0,
  });

  const checks: LaunchGateCheck[] = [
    {
      id: "health-database",
      label: "Database health",
      passed: health.services.database.ok,
      details: health.services.database.ok ? "Database responds" : health.services.database.error ?? "DB not healthy",
    },
    {
      id: "health-auth-secret",
      label: "Auth session secret configured",
      passed: health.services.auth.nextAuthSecretConfigured,
      details: health.services.auth.nextAuthSecretConfigured
        ? "NEXTAUTH_SECRET configured"
        : "NEXTAUTH_SECRET missing",
    },
    {
      id: "health-admin-account",
      label: "At least one active admin account",
      passed: health.services.adminAccounts.activeCount > 0,
      details:
        health.services.adminAccounts.activeCount > 0
          ? `${health.services.adminAccounts.activeCount} active admin account(s)`
          : "No active admin account found",
    },
    {
      id: "health-admin-mfa",
      label: "All active admins have MFA enabled",
      passed: health.services.adminMfa.adminsWithoutMfa === 0,
      details:
        health.services.adminMfa.adminsWithoutMfa === 0
          ? "All active admins have MFA enabled"
          : `${health.services.adminMfa.adminsWithoutMfa} active admin(s) without MFA`,
    },
    {
      id: "health-cron-secret",
      label: "Reconciliation cron secret configured",
      passed: health.services.reconciliationCron.configured,
      details: health.services.reconciliationCron.configured
        ? "OPS_CRON_SECRET configured"
        : "OPS_CRON_SECRET missing",
    },
    {
      id: "alert-routing",
      label: "Ops alert routing destination configured",
      passed: health.services.alertRouting.configured,
      details: health.services.alertRouting.configured
        ? "OPS_ALERT_WEBHOOK_URL configured"
        : "OPS_ALERT_WEBHOOK_URL missing",
    },
    {
      id: "health-stripe",
      label: "Stripe configured",
      passed: health.services.stripe.configured,
      details: health.services.stripe.configured ? "Stripe key loaded" : "Stripe key missing",
    },
    {
      id: "reconciliation-clean",
      label: "Reconciliation has no critical issue backlog",
      passed: reconciliation.summary.issuesCount === 0,
      details:
        reconciliation.summary.issuesCount === 0
          ? "No reconciliation issues"
          : `${reconciliation.summary.issuesCount} issue(s) require review`,
    },
    {
      id: "ops-alert-severity",
      label: "Operational alerts not critical",
      passed: alerts.highestSeverity !== "critical",
      details:
        alerts.highestSeverity === "critical"
          ? "Critical operational alert present"
          : alerts.highestSeverity === "warn"
            ? "Only warning-level alerts present"
            : "No warning/critical alerts",
    },
  ];

  return {
    readyToLaunch: checks.every((check) => check.passed),
    generatedAt: new Date().toISOString(),
    checks,
  };
}
