import { NextResponse } from "next/server";
import { WebhookEventStatus } from "@/generated/prisma/enums";
import Stripe from "stripe";

import { createOrdersFromPendingCheckout } from "@/app/api/checkout/confirm/route";
import { finalizeOrderPayment } from "@/lib/payment-finalizer";
import { logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const PROCESSING_STALE_AFTER_MS = 10 * 60 * 1000;

async function claimStripeEvent(eventId: string, eventType: string) {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId,
        provider: "stripe",
        eventType,
        status: WebhookEventStatus.PROCESSING,
      },
    });

    return { shouldProcess: true as const };
  } catch {
    const existing = await prisma.stripeWebhookEvent.findUnique({ where: { eventId } });
    if (!existing) {
      return { shouldProcess: false as const, alreadyProcessed: false as const };
    }

    if (existing.status === WebhookEventStatus.PROCESSED) {
      return { shouldProcess: false as const, alreadyProcessed: true as const };
    }

    if (existing.status === WebhookEventStatus.PROCESSING) {
      const staleCutoff = Date.now() - PROCESSING_STALE_AFTER_MS;
      if (existing.updatedAt.getTime() > staleCutoff) {
        return { shouldProcess: false as const, alreadyProcessed: false as const };
      }

      // Recovery path for webhook rows stuck in PROCESSING due to crash/timeout.
      await prisma.stripeWebhookEvent.update({
        where: { eventId },
        data: {
          status: WebhookEventStatus.PROCESSING,
          lastError: null,
          eventType,
          attemptCount: { increment: 1 },
        },
      });

      return { shouldProcess: true as const, recoveredStaleProcessing: true as const };
    }

    if (existing.status === WebhookEventStatus.FAILED) {
      await prisma.stripeWebhookEvent.update({
        where: { eventId },
        data: {
          status: WebhookEventStatus.PROCESSING,
          lastError: null,
          eventType,
          attemptCount: { increment: 1 },
        },
      });

      return { shouldProcess: true as const, retryingFailedEvent: true as const };
    }

    return { shouldProcess: false as const, alreadyProcessed: false as const };
  }
}

export async function POST(request: Request) {
  if (!stripe) {
    logApiEvent("warn", "payments.webhook.stripe_not_configured");
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    logApiEvent("warn", "payments.webhook.missing_config");
    return NextResponse.json({ error: "Missing webhook configuration." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    logApiEvent("warn", "payments.webhook.invalid_signature");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const claim = await claimStripeEvent(event.id, event.type);
  if (!claim.shouldProcess) {
    logApiEvent("info", "payments.webhook.duplicate", {
      eventId: event.id,
      eventType: event.type,
      alreadyProcessed: claim.alreadyProcessed ?? false,
    });
    return NextResponse.json({ received: true, duplicate: true, processed: claim.alreadyProcessed ?? false });
  }

  if (claim.recoveredStaleProcessing) {
    logApiEvent("warn", "payments.webhook.recovered_stale_processing", {
      eventId: event.id,
      eventType: event.type,
    });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata.orderId;
      const pendingCheckoutId = paymentIntent.metadata.pendingCheckoutId;

      if (orderId) {
        await finalizeOrderPayment(orderId, paymentIntent.id, "SUCCEEDED");
      } else if (pendingCheckoutId) {
        await createOrdersFromPendingCheckout(pendingCheckoutId, paymentIntent.id);
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata.orderId;

      if (orderId) {
        await finalizeOrderPayment(orderId, paymentIntent.id, "FAILED");
      }
    }

    await prisma.stripeWebhookEvent.update({
      where: { eventId: event.id },
      data: {
        status: WebhookEventStatus.PROCESSED,
        processedAt: new Date(),
        lastError: null,
      },
    });

    logApiEvent("info", "payments.webhook.processed", {
      eventId: event.id,
      eventType: event.type,
    });
  } catch (error) {
    const lastError = error instanceof Error ? error.message.slice(0, 2000) : "Unknown webhook processing error";

    await prisma.stripeWebhookEvent.update({
      where: { eventId: event.id },
      data: {
        status: WebhookEventStatus.FAILED,
        lastError,
      },
    });

    logApiEvent("error", "payments.webhook.processing_failed", {
      eventId: event.id,
      eventType: event.type,
      lastError,
    });

    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
