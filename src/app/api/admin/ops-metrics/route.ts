import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { WebhookEventStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  ]);

  const paymentFailureRate = paymentFailed / Math.max(paymentSucceeded, 1);

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
    recentWebhookFailures,
  });
}
