import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { WebhookEventStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { evaluateOpsAlerts, getOpsAlertThresholds } from "@/lib/ops-alerts";
import { getLastPendingPayoutAutoRetryReport } from "@/lib/pending-payout-auto-retry-store";
import { prisma } from "@/lib/prisma";
import { getSellerStripeAccountId } from "@/lib/site-config";
import { listSellerPayouts } from "@/lib/seller-payout-ledger";

const querySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
});

const WEBHOOK_PROCESSING_STALE_AFTER_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ hours: searchParams.get("hours") ?? undefined });
  const hours = parsed.success ? parsed.data.hours : 24;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const stalePendingCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const staleWebhookProcessingCutoff = new Date(Date.now() - WEBHOOK_PROCESSING_STALE_AFTER_MS);

  const [
    webhookEventsTotal,
    webhookProcessed,
    webhookFailed,
    webhookProcessing,
    webhookRetrying,
    webhookStaleProcessing,
    paymentFailed,
    paymentSucceeded,
    stalePendingOrders,
    pendingPaymentOrders,
    recentWebhookFailures,
    payouts,
    lastAutoRetryReport,
  ] = await Promise.all([
    prisma.stripeWebhookEvent.count({ where: { createdAt: { gte: since } } }),
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
    prisma.payment.count({
      where: { updatedAt: { gte: since }, status: "FAILED" },
    }),
    prisma.payment.count({
      where: { updatedAt: { gte: since }, status: "SUCCEEDED" },
    }),
    prisma.order.count({
      where: { status: "PENDING_PAYMENT", createdAt: { lt: stalePendingCutoff } },
    }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
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
    getLastPendingPayoutAutoRetryReport(),
  ]);

  const pendingPayouts = payouts.filter((entry) => entry.status === "PLATFORM_PENDING");
  const pendingPayoutTotalCents = pendingPayouts.reduce((sum, entry) => sum + entry.sellerPayoutCents, 0);
  const completedPayoutTotalCents = payouts
    .filter((entry) => entry.status !== "PLATFORM_PENDING")
    .reduce((sum, entry) => sum + entry.sellerPayoutCents, 0);

  const pendingWithoutConnect = (
    await Promise.all(
      pendingPayouts.map(async (entry) => {
        const account = await getSellerStripeAccountId(entry.sellerId);
        return account ? 0 : 1;
      }),
    )
  ).reduce<number>((sum, value) => sum + value, 0);

  const paymentFailureRate = paymentFailed / Math.max(paymentSucceeded, 1);
  const thresholds = getOpsAlertThresholds();
  const evaluatedAlerts = evaluateOpsAlerts(
    {
      paymentFailed,
      paymentSucceeded,
      webhookFailed,
      webhookStaleProcessing,
      stalePendingOrders,
      pendingPayoutCount: pendingPayouts.length,
      pendingPayoutTotalCents,
      pendingWithoutConnect,
    },
    thresholds,
  );

  return NextResponse.json({
    windowHours: hours,
    since,
    webhooks: {
      total: webhookEventsTotal,
      processed: webhookProcessed,
      failed: webhookFailed,
      processing: webhookProcessing,
      staleProcessing: webhookStaleProcessing,
      retrying: webhookRetrying,
    },
    payments: {
      failed: paymentFailed,
      succeeded: paymentSucceeded,
      failureRate: paymentFailureRate,
    },
    orders: {
      pendingPayment: pendingPaymentOrders,
      stalePendingPayment: stalePendingOrders,
    },
    payouts: {
      pendingCount: pendingPayouts.length,
      pendingTotalCents: pendingPayoutTotalCents,
      completedTotalCents: completedPayoutTotalCents,
      pendingWithoutConnect,
    },
    alerts: {
      highestSeverity: evaluatedAlerts.highestSeverity,
      items: evaluatedAlerts.alerts,
      thresholds,
    },
    pendingPayoutAutoRetry: lastAutoRetryReport,
    recentWebhookFailures,
  });
}
