import { getServerSession } from "next-auth";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { WebhookEventStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { evaluateOpsAlerts } from "@/lib/ops-alerts";
import { reconcileSellerPayouts } from "@/lib/payout-reconciliation";
import { prisma } from "@/lib/prisma";
import { getSellerStripeAccountId } from "@/lib/site-config";
import { listSellerPayouts } from "@/lib/seller-payout-ledger";
import { getLaunchReadiness } from "@/lib/launch-readiness";
import { saveReconciliationReport, getLastReconciliationReport } from "@/lib/reconciliation-report-store";
import { getSystemHealth } from "@/lib/system-health";

export const metadata = { title: "Operations - Admin" };

const WEBHOOK_PROCESSING_STALE_AFTER_MS = 10 * 60 * 1000;

function formatMoney(cents: number) {
  return `£${(cents / 100).toFixed(2)}`;
}

export default async function AdminOpsPage() {
    async function runReconciliationNowAction() {
      "use server";

      const currentSession = await getServerSession(authOptions);
      if (!currentSession?.user || currentSession.user.role !== "ADMIN") {
        return;
      }

      const result = await reconcileSellerPayouts();
      await saveReconciliationReport({
        generatedAt: result.generatedAt,
        source: "manual",
        summary: result.summary,
        issuesPreview: result.issues.slice(0, 25),
      });

      revalidatePath("/admin/ops");
    }

  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/ops");
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const stalePendingCutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const staleWebhookProcessingCutoff = new Date(now.getTime() - WEBHOOK_PROCESSING_STALE_AFTER_MS);

  const [
    webhookProcessed,
    webhookFailed,
    webhookProcessing,
    webhookRetrying,
    webhookStaleProcessing,
    paymentFailed,
    paymentSucceeded,
    pendingPaymentOrders,
    stalePendingOrders,
    recentWebhookFailures,
    payouts,
  ] = await Promise.all([
    prisma.stripeWebhookEvent.count({
      where: { createdAt: { gte: since }, status: WebhookEventStatus.PROCESSED },
    }),
    prisma.stripeWebhookEvent.count({
      where: { createdAt: { gte: since }, status: WebhookEventStatus.FAILED },
    }),
    prisma.stripeWebhookEvent.count({
      where: { createdAt: { gte: since }, status: WebhookEventStatus.PROCESSING },
    }),
    prisma.stripeWebhookEvent.count({
      where: { createdAt: { gte: since }, attemptCount: { gt: 1 } },
    }),
    prisma.stripeWebhookEvent.count({
      where: {
        createdAt: { gte: since },
        status: WebhookEventStatus.PROCESSING,
        updatedAt: { lt: staleWebhookProcessingCutoff },
      },
    }),
    prisma.payment.count({ where: { updatedAt: { gte: since }, status: "FAILED" } }),
    prisma.payment.count({ where: { updatedAt: { gte: since }, status: "SUCCEEDED" } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT", createdAt: { lt: stalePendingCutoff } } }),
    prisma.stripeWebhookEvent.findMany({
      where: { status: WebhookEventStatus.FAILED },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        eventId: true,
        eventType: true,
        attemptCount: true,
        lastError: true,
        updatedAt: true,
      },
    }),
    listSellerPayouts(),
  ]);

  const pendingPayouts = payouts.filter((entry) => entry.status === "PLATFORM_PENDING");
  const pendingPayoutTotalCents = pendingPayouts.reduce((sum, entry) => sum + entry.sellerPayoutCents, 0);
  const pendingWithoutConnect = (
    await Promise.all(
      pendingPayouts.map(async (entry) => {
        const account = await getSellerStripeAccountId(entry.sellerId);
        return account ? 0 : 1;
      }),
    )
  ).reduce<number>((sum, value) => sum + value, 0);

  const evaluatedAlerts = evaluateOpsAlerts({
    paymentFailed,
    paymentSucceeded,
    webhookFailed,
    webhookStaleProcessing,
    stalePendingOrders,
    pendingPayoutCount: pendingPayouts.length,
    pendingPayoutTotalCents,
    pendingWithoutConnect,
  });

  const reconciliation = await reconcileSellerPayouts();
  const [systemHealth, launchReadiness, lastReconciliationReport] = await Promise.all([
    getSystemHealth(),
    getLaunchReadiness(),
    getLastReconciliationReport(),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold text-(--accent-terra)">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-foreground/70">24-hour reliability and payment processing health.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Admin Dashboard
          </Link>
          <Link href="/admin/launch-config" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Launch Config
          </Link>
          <Link href="/admin/payout-reconciliation" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Reconciliation Report
          </Link>
          <Link href="/api/admin/ops-metrics" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Raw JSON
          </Link>
          <Link href="/api/admin/system-health" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            System Health JSON
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Webhooks Processed (24h)</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">{webhookProcessed}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Webhook Failures (24h)</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{webhookFailed}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Payment Failures (24h)</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{paymentFailed}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Succeeded Payments (24h)</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">{paymentSucceeded}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Webhook Processing (24h)</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{webhookProcessing}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Webhook Retries (24h)</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{webhookRetrying}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Stale Webhook Processing</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{webhookStaleProcessing}</p>
          <p className="mt-1 text-xs text-foreground/60">processing events older than 10 minutes</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Stale Pending Orders</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{stalePendingOrders}</p>
          <p className="mt-1 text-xs text-foreground/60">of {pendingPaymentOrders} pending payment orders</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Pending Seller Payouts</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{pendingPayouts.length}</p>
          <p className="mt-1 text-xs text-foreground/60">Total {formatMoney(pendingPayoutTotalCents)}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Pending Payouts Without Connect</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{pendingWithoutConnect}</p>
          <p className="mt-1 text-xs text-foreground/60">Require manual payout route</p>
        </article>
      </section>

      <section className="mt-8 rounded-xl border border-(--accent-terra)/25 bg-white p-5">
        <h2 className="text-lg font-semibold text-(--accent-terra)">Operational Alerts</h2>
        <p className="mt-1 text-sm text-foreground/60">Threshold-driven warning and critical signals for payments, webhooks, and payouts.</p>
        <div className="mt-3 space-y-2">
          {evaluatedAlerts.alerts.map((alert) => (
            <article key={alert.id} className="rounded-md border border-(--accent-terra)/20 p-3 text-sm">
              <p
                className={`font-semibold ${
                  alert.severity === "critical"
                    ? "text-red-700"
                    : alert.severity === "warn"
                      ? "text-amber-700"
                      : "text-emerald-700"
                }`}
              >
                {alert.severity.toUpperCase()}: {alert.message}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-(--accent-terra)/25 bg-white p-5">
        <h2 className="text-lg font-semibold text-(--accent-terra)">Payout Reconciliation Snapshot</h2>
        <p className="mt-1 text-sm text-foreground/60">Latest consistency check across ledger, payment state, and Stripe transfer records.</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-foreground/60">
            Last persisted run: {lastReconciliationReport?.generatedAt ? new Date(lastReconciliationReport.generatedAt).toLocaleString("en-GB") : "none"}
          </p>
          <form action={runReconciliationNowAction}>
            <button type="submit" className="rounded-md border border-(--accent-terra) px-3 py-2 text-xs text-(--accent-terra)">
              Run Reconciliation Now
            </button>
          </form>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Scanned</p>
            <p className="mt-1 text-xl font-semibold">{reconciliation.summary.scanned}</p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Issues</p>
            <p className={`mt-1 text-xl font-semibold ${reconciliation.summary.issuesCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {reconciliation.summary.issuesCount}
            </p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Stripe Checks</p>
            <p className="mt-1 text-xl font-semibold">{reconciliation.summary.stripeChecksPerformed}</p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Stripe Enabled</p>
            <p className="mt-1 text-xl font-semibold">{reconciliation.summary.stripeEnabled ? "Yes" : "No"}</p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Last Run Source</p>
            <p className="mt-1 text-xl font-semibold">{lastReconciliationReport?.source ?? "none"}</p>
          </article>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-(--accent-terra)/25 bg-white p-5">
        <h2 className="text-lg font-semibold text-(--accent-terra)">System Health</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Overall</p>
            <p className={`mt-1 text-xl font-semibold ${systemHealth.ok ? "text-emerald-700" : "text-red-700"}`}>
              {systemHealth.ok ? "Healthy" : "Degraded"}
            </p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Database</p>
            <p className={`mt-1 text-xl font-semibold ${systemHealth.services.database.ok ? "text-emerald-700" : "text-red-700"}`}>
              {systemHealth.services.database.ok ? "OK" : "Fail"}
            </p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Stripe Config</p>
            <p className={`mt-1 text-xl font-semibold ${systemHealth.services.stripe.configured ? "text-emerald-700" : "text-amber-700"}`}>
              {systemHealth.services.stripe.configured ? "Configured" : "Missing"}
            </p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Cron Secret</p>
            <p className={`mt-1 text-xl font-semibold ${systemHealth.services.reconciliationCron.configured ? "text-emerald-700" : "text-amber-700"}`}>
              {systemHealth.services.reconciliationCron.configured ? "Configured" : "Missing"}
            </p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Auth Secret</p>
            <p className={`mt-1 text-xl font-semibold ${systemHealth.services.auth.nextAuthSecretConfigured ? "text-emerald-700" : "text-amber-700"}`}>
              {systemHealth.services.auth.nextAuthSecretConfigured ? "Configured" : "Missing"}
            </p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Active Admins</p>
            <p className={`mt-1 text-xl font-semibold ${systemHealth.services.adminAccounts.activeCount > 0 ? "text-emerald-700" : "text-red-700"}`}>
              {systemHealth.services.adminAccounts.activeCount}
            </p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Admin MFA</p>
            <p className={`mt-1 text-xl font-semibold ${systemHealth.services.adminMfa.adminsWithoutMfa === 0 ? "text-emerald-700" : "text-red-700"}`}>
              {systemHealth.services.adminMfa.adminsWithoutMfa === 0 ? "All enabled" : `${systemHealth.services.adminMfa.adminsWithoutMfa} missing`}
            </p>
            <p className="mt-1 text-xs text-foreground/60">
              {systemHealth.services.adminMfa.adminsWithoutMfa > 0 && (
                <a href="/admin/mfa-setup" className="underline text-amber-700">Set up MFA →</a>
              )}
            </p>
          </article>
          <article className="rounded-md border border-(--accent-terra)/20 p-3">
            <p className="text-xs uppercase text-foreground/50">Alert Routing</p>
            <p className={`mt-1 text-xl font-semibold ${systemHealth.services.alertRouting.configured ? "text-emerald-700" : "text-amber-700"}`}>
              {systemHealth.services.alertRouting.configured ? "Configured" : "Missing"}
            </p>
            <p className="mt-1 text-xs text-foreground/60">
              Last send: {systemHealth.services.alertRouting.lastSuccessAt ? new Date(systemHealth.services.alertRouting.lastSuccessAt).toLocaleString("en-GB") : "none"}
            </p>
          </article>
        </div>
        {systemHealth.services.alertRouting.lastError ? (
          <p className="mt-3 text-xs text-red-700">Alert delivery error: {systemHealth.services.alertRouting.lastError}</p>
        ) : null}
      </section>

      <section className="mt-8 rounded-xl border border-(--accent-terra)/25 bg-white p-5">
        <h2 className="text-lg font-semibold text-(--accent-terra)">Launch Readiness Gate</h2>
        <p className="mt-1 text-sm text-foreground/60">Automated runtime checks that indicate whether launch gate conditions are currently satisfied.</p>
        <p className={`mt-3 text-sm font-semibold ${launchReadiness.readyToLaunch ? "text-emerald-700" : "text-red-700"}`}>
          {launchReadiness.readyToLaunch ? "READY TO LAUNCH" : "NOT READY TO LAUNCH"}
        </p>
        <div className="mt-3 space-y-2">
          {launchReadiness.checks.map((check) => (
            <article key={check.id} className="rounded-md border border-(--accent-terra)/20 p-3 text-sm">
              <p className={`font-semibold ${check.passed ? "text-emerald-700" : "text-red-700"}`}>
                {check.passed ? "PASS" : "FAIL"}: {check.label}
              </p>
              <p className="mt-1 text-xs text-foreground/70">{check.details}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-(--accent-terra)/25 bg-white p-5">
        <h2 className="text-lg font-semibold text-(--accent-terra)">Recent Webhook Failures</h2>
        <div className="mt-3 space-y-2">
          {recentWebhookFailures.length === 0 ? <p className="text-sm text-foreground/60">No failed webhook events.</p> : null}
          {recentWebhookFailures.map((failure) => (
            <article key={failure.eventId} className="rounded-md border border-(--accent-terra)/20 p-3 text-sm">
              <p className="font-medium">{failure.eventType}</p>
              <p className="mt-1 text-xs text-foreground/60">Event: {failure.eventId}</p>
              <p className="mt-1 text-xs text-foreground/60">Attempts: {failure.attemptCount}</p>
              <p className="mt-1 text-xs text-foreground/60">Updated: {new Date(failure.updatedAt).toLocaleString("en-GB")}</p>
              {failure.lastError ? <p className="mt-2 text-xs text-red-600">{failure.lastError}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
