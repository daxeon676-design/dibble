import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WebhookEventStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Operations - Admin" };

const WEBHOOK_PROCESSING_STALE_AFTER_MS = 10 * 60 * 1000;

export default async function AdminOpsPage() {
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
          <Link href="/api/admin/ops-metrics" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Raw JSON
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
