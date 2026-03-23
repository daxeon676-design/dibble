import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { getRequestId, logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { calculateMarketplaceSplit, getSellerStripeAccountId, getSiteConfig } from "@/lib/site-config";
import { stripe } from "@/lib/stripe";

const createIntentSchema = z.object({
  orderId: z.string().uuid(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    logApiEvent("warn", "payments.intent.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    scope: "payments-intent",
    limit: 30,
    windowMs: 60_000,
    key: `user:${session.user.id}`,
  });

  if (!rateLimit.ok) {
    logApiEvent("warn", "payments.intent.rate_limited", {
      requestId,
      userId: session.user.id,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return NextResponse.json(
      { error: "Too many payment initialization attempts. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createIntentSchema.safeParse(json);
  if (!parsed.success) {
    logApiEvent("warn", "payments.intent.invalid_payload", { requestId, userId: session.user.id });
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { payment: true },
  });

  if (!order || order.buyerId !== session.user.id) {
    logApiEvent("warn", "payments.intent.order_not_found", {
      requestId,
      userId: session.user.id,
      orderId: parsed.data.orderId,
    });
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status !== OrderStatus.PENDING_PAYMENT) {
    return NextResponse.json({ error: "Order is not awaiting payment." }, { status: 409 });
  }

  if (!order.payment) {
    return NextResponse.json({ error: "Payment record missing." }, { status: 500 });
  }

  if (!stripe) {
    logApiEvent("warn", "payments.intent.stripe_not_configured", {
      requestId,
      userId: session.user.id,
      orderId: order.id,
    });
    return NextResponse.json(
      {
        error: "Stripe is not configured. Use simulate mode in /api/payments/confirm.",
      },
      { status: 503 },
    );
  }

  let intentId = order.payment.stripePaymentIntent;

  if (!intentId) {
    const config = await getSiteConfig();
    const split = calculateMarketplaceSplit(order.totalCents, config.platformFeePercent);
    const sellerStripeAccountId = await getSellerStripeAccountId(order.sellerId);
    const payoutMode = sellerStripeAccountId ? "destination_charge" : "platform_only";

    const intent = await stripe.paymentIntents.create({
      amount: order.totalCents,
      currency: "gbp",
      metadata: {
        orderId: order.id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        platformFeeCents: String(split.platformFeeCents),
        sellerPayoutCents: String(split.sellerPayoutCents),
        platformFeePercent: String(config.platformFeePercent),
        payoutMode,
      },
      ...(sellerStripeAccountId
        ? {
            application_fee_amount: split.platformFeeCents,
            transfer_data: {
              destination: sellerStripeAccountId,
            },
            transfer_group: `order_${order.id}`,
          }
        : {}),
      payment_method_types: ["card"],
    });

    intentId = intent.id;

    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        stripePaymentIntent: intent.id,
        status: PaymentStatus.PENDING,
      },
    });

    logApiEvent("info", "payments.intent.created", {
      requestId,
      userId: session.user.id,
      orderId: order.id,
      paymentIntentId: intent.id,
      payoutMode,
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      commission: {
        platformFeeCents: split.platformFeeCents,
        sellerPayoutCents: split.sellerPayoutCents,
      },
      payoutMode,
    });
  }

  const intent = await stripe.paymentIntents.retrieve(intentId);

  logApiEvent("info", "payments.intent.reused", {
    requestId,
    userId: session.user.id,
    orderId: order.id,
    paymentIntentId: intent.id,
  });

  return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
}
