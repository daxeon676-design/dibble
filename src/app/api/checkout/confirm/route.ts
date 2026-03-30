import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NotificationType, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { deleteCartItemMetaMany } from "@/lib/cart-item-meta";
import { getCouponByCode, incrementCouponUsage } from "@/lib/coupons";
import { sendPreferenceAwareEmail } from "@/lib/preference-email";
import { getRequestId, logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { tryAutoTransferSellerPayout } from "@/lib/seller-payout-automation";
import { calculateMarketplaceSplit, getSellerStripeAccountId, getSiteConfig } from "@/lib/site-config";
import { upsertSellerPayout } from "@/lib/seller-payout-ledger";
import { stripe } from "@/lib/stripe";

const schema = z.object({
  paymentIntentId: z.string().optional(),
  pendingCheckoutId: z.string().uuid().optional(),
  simulate: z.boolean().default(false),
});

type CartSnapshotGroup = {
  sellerId: string;
  subtotalCents: number;
  deliveryCostCents: number;
  discountCents?: number;
  totalCents: number;
  items: Array<{
    productId: string;
    productTitle: string;
    productDescription: string;
    quantity: number;
    unitPriceCents: number;
    variantId?: string | null;
    variantLabel?: string | null;
  }>;
};

type CartSnapshot = {
  groups: CartSnapshotGroup[];
  deliveryOptionId: string;
  deliveryOptionName: string;
  coupon?: {
    code: string;
    discountCents: number;
    sellerId: string | null;
  } | null;
};

export async function createOrdersFromPendingCheckout(
  pendingCheckoutId: string,
  intentId: string,
): Promise<{ orderIds: string[]; alreadyProcessed: boolean }> {
  const pending = await prisma.pendingCheckout.findUnique({ where: { id: pendingCheckoutId } });

  if (!pending) {
    // Check whether orders already exist for this intent (idempotency).
    const existingPayment = await prisma.payment.findFirst({
      where: { stripePaymentIntent: intentId },
      include: { order: true },
    });
    if (existingPayment) {
      return { orderIds: [existingPayment.orderId], alreadyProcessed: true };
    }
    return { orderIds: [], alreadyProcessed: false };
  }

  const snapshot = pending.cartSnapshot as CartSnapshot;
  const config = await getSiteConfig();
  const createdOrderIds: string[] = [];
  const cartItemIdsToClear: string[] = [];
  const payoutTransferCandidates: Array<{
    orderId: string;
    sellerId: string;
    sellerPayoutCents: number;
    hasConnectedAccount: boolean;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const group of snapshot.groups) {
      // Atomically decrement stock for each item — reject if any item is now out of stock.
      for (const item of group.items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new Error(`STOCK_DEPLETED:${item.productId}:${item.productTitle}`);
        }
      }

      const order = await tx.order.create({
        data: {
          buyerId: pending.buyerId,
          sellerId: group.sellerId,
          status: OrderStatus.PROCESSING,
          totalCents: group.totalCents,
          addressFullName: pending.addressFullName,
          addressLine1: pending.addressLine1,
          addressLine2: pending.addressLine2,
          addressCity: pending.addressCity,
          addressPostalCode: pending.addressPostalCode,
          addressCountry: pending.addressCountry,
          items: {
            create: group.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              productSnapshot: JSON.stringify({
                title: item.productTitle,
                description: item.productDescription,
                variantId: item.variantId ?? null,
                variantLabel: item.variantLabel ?? null,
              }),
            })),
          },
          payment: {
            create: {
              amountCents: group.totalCents,
              status: PaymentStatus.SUCCEEDED,
              stripePaymentIntent: intentId,
            },
          },
        },
      });

      createdOrderIds.push(order.id);

      // Seller payout record.
      const split = calculateMarketplaceSplit(group.totalCents, config?.platformFeePercent ?? 0);
      const hasConnectedAccount = Boolean(await getSellerStripeAccountId(group.sellerId));
      try {
        await upsertSellerPayout({
          orderId: order.id,
          sellerId: group.sellerId,
          grossCents: group.totalCents,
          platformFeeCents: split.platformFeeCents,
          sellerPayoutCents: split.sellerPayoutCents,
          status: "PLATFORM_PENDING",
        });
      } catch (error) {
        logApiEvent("warn", "checkout.confirm.payout_ledger_failed", {
          orderId: order.id,
          sellerId: group.sellerId,
          error: error instanceof Error ? error.message : "Unknown payout ledger error",
        });
      }

      payoutTransferCandidates.push({
        orderId: order.id,
        sellerId: group.sellerId,
        sellerPayoutCents: split.sellerPayoutCents,
        hasConnectedAccount,
      });

      // Seller in-app notification.
      await tx.notification.create({
        data: {
          userId: group.sellerId,
          type: NotificationType.ORDER_UPDATE,
          title: "New order received",
          body: `You have a new order worth £${(group.totalCents / 100).toFixed(2)}.`,
          href: `/seller/orders/${order.id}`,
        },
      });
    }

    const currentCartItems = await tx.cartItem.findMany({
      where: { cart: { buyerId: pending.buyerId } },
      select: { id: true },
    });
    cartItemIdsToClear.push(...currentCartItems.map((item) => item.id));

    // Clear the buyer's cart.
    await tx.cartItem.deleteMany({
      where: { cart: { buyerId: pending.buyerId } },
    });

    // Remove the pending checkout record.
    await tx.pendingCheckout.delete({ where: { id: pendingCheckoutId } });
  });

  await deleteCartItemMetaMany(cartItemIdsToClear);

  // Attempt automatic payout transfers for connected sellers.
  // This is intentionally non-blocking; failures remain in PLATFORM_PENDING.
  const paymentIntent = stripe ? await stripe.paymentIntents.retrieve(intentId).catch(() => null) : null;
  const chargeId =
    paymentIntent?.latest_charge && typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : undefined;

  for (const candidate of payoutTransferCandidates) {
    if (!candidate.hasConnectedAccount) continue;
    await tryAutoTransferSellerPayout({
      orderId: candidate.orderId,
      sellerId: candidate.sellerId,
      sellerPayoutCents: candidate.sellerPayoutCents,
      chargeId,
    });
  }

  // Send seller emails outside the transaction (non-blocking).
  const sellerIds = snapshot.groups.map((g) => g.sellerId);
  const sellers = await prisma.user.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, email: true, displayName: true },
  });
  const buyer = await prisma.user.findUnique({
    where: { id: pending.buyerId },
    select: { email: true, displayName: true },
  });

  const deliveryAddress = [
    pending.addressFullName,
    pending.addressLine1,
    pending.addressLine2,
    pending.addressCity,
    pending.addressPostalCode,
    pending.addressCountry,
  ]
    .filter(Boolean)
    .join(", ");

  // Buyer order confirmation email.
  if (buyer) {
    const allItemRows = snapshot.groups
      .flatMap((g) =>
        g.items.map(
          (item) =>
            `<tr><td style="padding:4px 8px">${item.productTitle}</td><td style="padding:4px 8px">×${item.quantity}</td><td style="padding:4px 8px">£${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</td></tr>`,
        ),
      )
      .join("");
    const grandTotal = snapshot.groups.reduce((s, g) => s + g.totalCents, 0);
    const deliveryTotal = snapshot.groups.reduce((s, g) => s + g.deliveryCostCents, 0);

    await sendPreferenceAwareEmail({
      userId: pending.buyerId,
      preferenceKey: "orderUpdates",
      to: buyer.email,
      subject: `Your Dibble order is confirmed`,
      html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:4px">Order confirmed!</h2>
            <p>Hi ${buyer.displayName ?? buyer.email}, thanks for your order on Dibble.</p>
            <p>Your seller${snapshot.groups.length > 1 ? "s are" : " is"} now preparing your items. We'll let you know when ${snapshot.groups.length > 1 ? "they're" : "it's"} on the way.</p>

            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead><tr style="background:#f5f5f5">
                <th style="padding:6px 8px;text-align:left">Item</th>
                <th style="padding:6px 8px;text-align:left">Qty</th>
                <th style="padding:6px 8px;text-align:left">Price</th>
              </tr></thead>
              <tbody>${allItemRows}</tbody>
              <tfoot>
                <tr><td colspan="2" style="padding:6px 8px;font-weight:600">Delivery</td><td style="padding:6px 8px">£${(deliveryTotal / 100).toFixed(2)}</td></tr>
                <tr style="font-weight:700">
                  <td colspan="2" style="padding:6px 8px;border-top:2px solid #ccc">Total paid</td>
                  <td style="padding:6px 8px;border-top:2px solid #ccc">£${(grandTotal / 100).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <p><strong>Delivering to:</strong><br>${deliveryAddress}</p>

            <p style="margin-top:24px">
              <a href="https://dibble.farm/buyer/orders"
                 style="background:#2d5a27;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
                View your orders
              </a>
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#999;font-size:12px">Dibble · dibble.farm</p>
          </div>
        `,
    });
  }

  for (let i = 0; i < snapshot.groups.length; i++) {
    const group = snapshot.groups[i];
    const seller = sellers.find((s) => s.id === group.sellerId);
    if (!seller) continue;

    const orderId = createdOrderIds[i];
    const itemRows = group.items
      .map((item) => `<tr><td style="padding:4px 8px">${item.productTitle}</td><td style="padding:4px 8px">×${item.quantity}</td><td style="padding:4px 8px">£${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</td></tr>`)
      .join("");

    await sendPreferenceAwareEmail({
      userId: seller.id,
      preferenceKey: "orderUpdates",
      to: seller.email,
      subject: `New order #${orderId.slice(0, 8).toUpperCase()} on Dibble`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="margin-bottom:4px">New order received!</h2>
          <p>Hi ${seller.displayName ?? seller.email},</p>
          <p>Great news — you have a new order on Dibble from <strong>${buyer?.displayName ?? buyer?.email ?? "a buyer"}</strong>.</p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:6px 8px;text-align:left">Item</th>
                <th style="padding:6px 8px;text-align:left">Qty</th>
                <th style="padding:6px 8px;text-align:left">Price</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:6px 8px;font-weight:600">Delivery (${snapshot.deliveryOptionName})</td>
                <td style="padding:6px 8px">£${(group.deliveryCostCents / 100).toFixed(2)}</td>
              </tr>
              <tr style="font-weight:700">
                <td colspan="2" style="padding:6px 8px;border-top:2px solid #ccc">Order Total</td>
                <td style="padding:6px 8px;border-top:2px solid #ccc">£${(group.totalCents / 100).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <p><strong>Delivery address:</strong><br>${deliveryAddress}</p>

          <p style="margin-top:24px">
            <a href="https://dibblemarketplace.com/seller/orders"
               style="background:#2d5a27;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
              View Order
            </a>
          </p>

          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#999;font-size:12px">Dibble Marketplace · dibblemarketplace.com</p>
        </div>
      `,
    });
  }

  if (snapshot.coupon?.code) {
    const coupon = await getCouponByCode(snapshot.coupon.code);
    if (coupon) {
      await incrementCouponUsage(coupon.id).catch(() => null);
    }
  }

  return { orderIds: createdOrderIds, alreadyProcessed: false };
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    scope: "checkout-confirm",
    limit: 20,
    windowMs: 60_000,
    key: `user:${session.user.id}`,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many confirmation attempts. Please wait." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  // Simulation mode (when Stripe is not configured).
  if (parsed.data.simulate || !stripe) {
    const pending = await prisma.pendingCheckout.findFirst({
      where: { buyerId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!pending) {
      return NextResponse.json({ error: "No pending checkout found." }, { status: 404 });
    }

    const result = await createOrdersFromPendingCheckout(pending.id, `sim_${pending.id}`);

    logApiEvent("info", "checkout.confirm.simulated", {
      requestId,
      userId: session.user.id,
      orderIds: result.orderIds,
    });

    return NextResponse.json({ orderIds: result.orderIds, simulated: true });
  }

  // Real Stripe payment confirmation.
  const intentId = parsed.data.paymentIntentId;
  if (!intentId) {
    return NextResponse.json({ error: "paymentIntentId is required." }, { status: 400 });
  }

  // Retrieve intent from Stripe to verify it succeeded.
  const intent = await stripe.paymentIntents.retrieve(intentId);

  if (intent.status !== "succeeded") {
    logApiEvent("warn", "checkout.confirm.intent_not_succeeded", {
      requestId,
      userId: session.user.id,
      intentId,
      intentStatus: intent.status,
    });
    return NextResponse.json(
      { error: "Payment has not completed yet.", paymentIntentStatus: intent.status },
      { status: 409 },
    );
  }

  // Look up pending checkout via intent metadata or by buyer.
  const pendingCheckoutId =
    intent.metadata?.pendingCheckoutId ??
    (await prisma.pendingCheckout
      .findFirst({ where: { buyerId: session.user.id }, orderBy: { createdAt: "desc" }, select: { id: true } })
      .then((r) => r?.id));

  if (!pendingCheckoutId) {
    // Already processed — return existing order IDs.
    const existingPayment = await prisma.payment.findFirst({
      where: { stripePaymentIntent: intentId },
    });
    if (existingPayment) {
      logApiEvent("info", "checkout.confirm.already_processed", { requestId, userId: session.user.id, intentId });
      return NextResponse.json({ orderIds: [existingPayment.orderId], alreadyProcessed: true });
    }
    return NextResponse.json({ error: "Checkout session not found." }, { status: 404 });
  }

  // Verify ownership.
  const pending = await prisma.pendingCheckout.findUnique({
    where: { id: pendingCheckoutId },
    select: { buyerId: true },
  });
  if (pending && pending.buyerId !== session.user.id) {
    logApiEvent("warn", "checkout.confirm.ownership_mismatch", { requestId, userId: session.user.id });
    return NextResponse.json({ error: "Checkout session not found." }, { status: 404 });
  }

  const result = await createOrdersFromPendingCheckout(pendingCheckoutId, intentId);

  if (!result.orderIds.length && !result.alreadyProcessed) {
    logApiEvent("error", "checkout.confirm.failed", { requestId, userId: session.user.id, intentId });
    return NextResponse.json({ error: "Unable to create order." }, { status: 500 });
  }

  logApiEvent("info", "checkout.confirm.success", {
    requestId,
    userId: session.user.id,
    orderIds: result.orderIds,
    alreadyProcessed: result.alreadyProcessed,
  });

  return NextResponse.json({ orderIds: result.orderIds, alreadyProcessed: result.alreadyProcessed });
}
