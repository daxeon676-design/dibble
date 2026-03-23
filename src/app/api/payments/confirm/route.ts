import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { getRequestId, logApiEvent } from "@/lib/observability";
import { finalizeOrderPayment } from "@/lib/payment-finalizer";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";

const confirmPaymentSchema = z.object({
  orderId: z.string().uuid(),
  simulate: z.boolean().default(false),
  paymentIntentId: z.string().optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    logApiEvent("warn", "payments.confirm.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    scope: "payments-confirm",
    limit: 30,
    windowMs: 60_000,
    key: `user:${session.user.id}`,
  });

  if (!rateLimit.ok) {
    logApiEvent("warn", "payments.confirm.rate_limited", {
      requestId,
      userId: session.user.id,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return NextResponse.json(
      { error: "Too many payment confirmation attempts. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = confirmPaymentSchema.safeParse(json);
  if (!parsed.success) {
    logApiEvent("warn", "payments.confirm.invalid_payload", { requestId, userId: session.user.id });
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { payment: true },
  });

  if (!order || order.buyerId !== session.user.id) {
    logApiEvent("warn", "payments.confirm.order_not_found", {
      requestId,
      userId: session.user.id,
      orderId: parsed.data.orderId,
    });
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status !== OrderStatus.PENDING_PAYMENT) {
    if (order.payment?.status === PaymentStatus.SUCCEEDED) {
      return NextResponse.json({ order, simulated: false, alreadyConfirmed: true });
    }

    return NextResponse.json({ error: "Order is not awaiting payment." }, { status: 409 });
  }

  if (!order.payment) {
    return NextResponse.json({ error: "Payment record missing." }, { status: 500 });
  }

  if (parsed.data.simulate || !stripe) {
    const finalized = await finalizeOrderPayment(order.id, `sim_${order.id}`, "SUCCEEDED");
    if (!finalized.order) {
      logApiEvent("error", "payments.confirm.simulated_finalize_failed", {
        requestId,
        userId: session.user.id,
        orderId: order.id,
      });
      return NextResponse.json({ error: "Unable to finalize payment." }, { status: 500 });
    }

    logApiEvent("info", "payments.confirm.simulated_success", {
      requestId,
      userId: session.user.id,
      orderId: order.id,
    });

    return NextResponse.json({ order: finalized.order, simulated: true });
  }

  const intentId = parsed.data.paymentIntentId ?? order.payment.stripePaymentIntent;
  if (!intentId) {
    return NextResponse.json({ error: "No payment intent id provided." }, { status: 400 });
  }

  const intent = await stripe.paymentIntents.retrieve(intentId);

  if (intent.status !== "succeeded") {
    logApiEvent("warn", "payments.confirm.intent_not_succeeded", {
      requestId,
      userId: session.user.id,
      orderId: order.id,
      paymentIntentId: intent.id,
      paymentIntentStatus: intent.status,
    });
    return NextResponse.json(
      { error: "Payment intent has not succeeded yet.", paymentIntentStatus: intent.status },
      { status: 409 },
    );
  }

  const finalized = await finalizeOrderPayment(order.id, intent.id, "SUCCEEDED");
  if (!finalized.order) {
    logApiEvent("error", "payments.confirm.finalize_failed", {
      requestId,
      userId: session.user.id,
      orderId: order.id,
      paymentIntentId: intent.id,
    });
    return NextResponse.json({ error: "Unable to finalize payment." }, { status: 500 });
  }

  logApiEvent("info", "payments.confirm.success", {
    requestId,
    userId: session.user.id,
    orderId: order.id,
    paymentIntentId: intent.id,
  });

  return NextResponse.json({ order: finalized.order, simulated: false });
}
