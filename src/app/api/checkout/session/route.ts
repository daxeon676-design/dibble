import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ProductStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { calculateOrderTotalCents, groupCartItemsBySeller } from "@/lib/checkout";
import { evaluateCoupon, getCouponByCode } from "@/lib/coupons";
import { getRequestId, logApiEvent } from "@/lib/observability";
import { getCartItemMetaMap } from "@/lib/cart-item-meta";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getSellerDeliverySettingsMap,
  getSiteConfig,
  resolveSellerDeliveryCostPence,
} from "@/lib/site-config";
import { getOrCreateStripeCustomer, stripe } from "@/lib/stripe";

const sessionSchema = z.object({
  deliveryOptionId: z.string().min(1),
  address: z.object({
    fullName: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }),
  couponCode: z.string().trim().min(3).max(32).optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    scope: "checkout-session",
    limit: 20,
    windowMs: 60_000,
    key: `user:${session.user.id}`,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = sessionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Delivery option and address are required." }, { status: 400 });
  }

  const config = await getSiteConfig();
  const selectedDelivery = config.deliveryOptions.find(
    (o) => o.id === parsed.data.deliveryOptionId && o.enabled,
  );
  if (!selectedDelivery) {
    return NextResponse.json({ error: "Selected delivery option is not available." }, { status: 409 });
  }

  const cart = await prisma.cart.findUnique({
    where: { buyerId: session.user.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              sellerId: true,
              title: true,
              description: true,
              priceCents: true,
              status: true,
              stock: true,
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 409 });
  }

  const invalidItem = cart.items.find(
    (item) => item.product.status !== ProductStatus.ACTIVE || item.product.stock < item.quantity,
  );
  if (invalidItem) {
    logApiEvent("warn", "checkout.session.invalid_item", {
      requestId,
      userId: session.user.id,
      productId: invalidItem.productId,
    });
    return NextResponse.json(
      { error: `"${invalidItem.product.title}" is unavailable or out of stock.` },
      { status: 409 },
    );
  }

  const cartMetaByItemId = await getCartItemMetaMap(cart.items.map((item) => item.id));
  const enrichedItems = cart.items.map((item) => ({
    ...item,
    variantId: cartMetaByItemId[item.id]?.variantId ?? null,
    variantLabel: cartMetaByItemId[item.id]?.variantLabel ?? null,
  }));

  const sellerDeliveryMap = await getSellerDeliverySettingsMap();
  const groupedBySeller = groupCartItemsBySeller(enrichedItems);
  const enabledOptionIds = config.deliveryOptions.filter((o) => o.enabled).map((o) => o.id);

  type SnapshotGroup = {
    sellerId: string;
    subtotalCents: number;
    deliveryCostCents: number;
    discountCents: number;
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

  const groups: SnapshotGroup[] = [];

  for (const [sellerId, items] of groupedBySeller.entries()) {
    const sellerSettings = sellerDeliveryMap[sellerId] ?? {
      optionIds: enabledOptionIds,
      customCostsPence: {},
      freeDeliveryThresholdPence: 0,
    };
    const offered = sellerSettings.optionIds;
    if (!offered.includes(selectedDelivery.id)) {
      return NextResponse.json(
        { error: "Selected delivery option is not offered by one or more sellers." },
        { status: 409 },
      );
    }
    const subtotalCents = calculateOrderTotalCents(items);
    const deliveryCostCents = resolveSellerDeliveryCostPence(
      sellerSettings,
      selectedDelivery.id,
      selectedDelivery.costPence,
      subtotalCents,
    );
    const totalCents = subtotalCents + deliveryCostCents;

    groups.push({
      sellerId,
      subtotalCents,
      deliveryCostCents,
      discountCents: 0,
      totalCents,
      items: items.map((item) => ({
        productId: item.productId,
        productTitle: item.variantLabel ? `${item.product.title} (${item.variantLabel})` : item.product.title,
        productDescription: item.product.description ?? "",
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCts,
        variantId: item.variantId,
        variantLabel: item.variantLabel,
      })),
    });
  }

  let couponSummary: { code: string; discountCents: number; sellerId: string | null } | null = null;

  if (parsed.data.couponCode) {
    const coupon = await getCouponByCode(parsed.data.couponCode);
    if (!coupon) {
      return NextResponse.json({ error: "Coupon code is invalid." }, { status: 409 });
    }

    const eligibleGroups = groups.filter(
      (group) => !coupon.sellerId || group.sellerId === coupon.sellerId,
    );
    const eligibleSubtotalCents = eligibleGroups.reduce((sum, group) => sum + group.subtotalCents, 0);

    const evaluated = evaluateCoupon(coupon, {
      subtotalCents: eligibleSubtotalCents,
      sellerIds: groups.map((group) => group.sellerId),
    });

    if (!evaluated.ok) {
      return NextResponse.json({ error: evaluated.error }, { status: 409 });
    }

    let remainingDiscount = evaluated.discountCents;
    for (let index = 0; index < eligibleGroups.length; index++) {
      const group = eligibleGroups[index];
      const isLast = index === eligibleGroups.length - 1;
      const proportional = isLast
        ? remainingDiscount
        : Math.floor((evaluated.discountCents * group.subtotalCents) / Math.max(1, eligibleSubtotalCents));
      const applied = Math.min(group.subtotalCents, proportional);
      group.discountCents = applied;
      group.totalCents = group.subtotalCents + group.deliveryCostCents - applied;
      remainingDiscount -= applied;
    }

    couponSummary = {
      code: coupon.code,
      discountCents: evaluated.discountCents,
      sellerId: coupon.sellerId,
    };
  }

  const grandTotalCents = groups.reduce((sum, group) => sum + group.totalCents, 0);

  const cartSnapshot = {
    groups,
    deliveryOptionId: selectedDelivery.id,
    deliveryOptionName: selectedDelivery.name,
    coupon: couponSummary,
  };

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  // Upsert the pending checkout for this buyer (one at a time).
  const existingPending = await prisma.pendingCheckout.findFirst({
    where: { buyerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  let pendingCheckoutId: string | null = null;
  let clientSecret: string | null = null;
  let stripeCustomerId: string | null = null;

  if (stripe) {
    if (session.user.email) {
      const customer = await getOrCreateStripeCustomer({
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
      stripeCustomerId = customer?.id ?? null;
    }

    if (existingPending?.stripePaymentIntent) {
      // Try to reuse the existing intent if amount matches.
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(existingPending.stripePaymentIntent);
        if (
          existingIntent.status === "requires_payment_method" &&
          existingIntent.amount === grandTotalCents
        ) {
          pendingCheckoutId = existingPending.id;
          clientSecret = existingIntent.client_secret;

          // Update snapshot + address in case something changed.
          await prisma.pendingCheckout.update({
            where: { id: existingPending.id },
            data: {
              deliveryOptionId: selectedDelivery.id,
              deliveryOptionName: selectedDelivery.name,
              addressFullName: parsed.data.address.fullName,
              addressLine1: parsed.data.address.addressLine1,
              addressLine2: parsed.data.address.addressLine2,
              addressCity: parsed.data.address.city,
              addressPostalCode: parsed.data.address.postalCode,
              addressCountry: parsed.data.address.country,
              cartSnapshot,
              totalCents: grandTotalCents,
              expiresAt,
            },
          });
        } else {
          // Cancel the old intent and create a new one.
          if (existingIntent.status !== "succeeded" && existingIntent.status !== "canceled") {
            await stripe.paymentIntents.cancel(existingPending.stripePaymentIntent);
          }
          await prisma.pendingCheckout.delete({ where: { id: existingPending.id } });
          existingPending.stripePaymentIntent = null; // fall through to create new
        }
      } catch {
        await prisma.pendingCheckout.delete({ where: { id: existingPending.id } }).catch(() => null);
      }
    } else if (existingPending) {
      await prisma.pendingCheckout.delete({ where: { id: existingPending.id } }).catch(() => null);
    }

    if (!clientSecret) {
      const intent = await stripe.paymentIntents.create({
        amount: grandTotalCents,
        currency: "gbp",
        metadata: { buyerId: session.user.id },
        automatic_payment_methods: { enabled: true },
        setup_future_usage: "off_session",
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      });
      clientSecret = intent.client_secret;

      const newCheckout = await prisma.pendingCheckout.create({
        data: {
          buyerId: session.user.id,
          deliveryOptionId: selectedDelivery.id,
          deliveryOptionName: selectedDelivery.name,
          addressFullName: parsed.data.address.fullName,
          addressLine1: parsed.data.address.addressLine1,
          addressLine2: parsed.data.address.addressLine2,
          addressCity: parsed.data.address.city,
          addressPostalCode: parsed.data.address.postalCode,
          addressCountry: parsed.data.address.country,
          cartSnapshot,
          totalCents: grandTotalCents,
          stripePaymentIntent: intent.id,
          expiresAt,
        },
      });

      // Update Stripe intent metadata with pendingCheckoutId for webhook lookup.
      await stripe.paymentIntents.update(intent.id, {
        metadata: { buyerId: session.user.id, pendingCheckoutId: newCheckout.id },
      });

      pendingCheckoutId = newCheckout.id;
    }
  } else {
    // Stripe not configured — simulation mode. Create/update pending checkout without intent.
    if (existingPending) {
      const updated = await prisma.pendingCheckout.update({
        where: { id: existingPending.id },
        data: {
          deliveryOptionId: selectedDelivery.id,
          deliveryOptionName: selectedDelivery.name,
          addressFullName: parsed.data.address.fullName,
          addressLine1: parsed.data.address.addressLine1,
          addressLine2: parsed.data.address.addressLine2,
          addressCity: parsed.data.address.city,
          addressPostalCode: parsed.data.address.postalCode,
          addressCountry: parsed.data.address.country,
          cartSnapshot,
          totalCents: grandTotalCents,
          expiresAt,
        },
      });
      pendingCheckoutId = updated.id;
    } else {
      const created = await prisma.pendingCheckout.create({
        data: {
          buyerId: session.user.id,
          deliveryOptionId: selectedDelivery.id,
          deliveryOptionName: selectedDelivery.name,
          addressFullName: parsed.data.address.fullName,
          addressLine1: parsed.data.address.addressLine1,
          addressLine2: parsed.data.address.addressLine2,
          addressCity: parsed.data.address.city,
          addressPostalCode: parsed.data.address.postalCode,
          addressCountry: parsed.data.address.country,
          cartSnapshot,
          totalCents: grandTotalCents,
          expiresAt,
        },
      });
      pendingCheckoutId = created.id;
    }
    clientSecret = null;
  }

  if (!pendingCheckoutId) {
    logApiEvent("error", "checkout.session.pending_checkout_missing", {
      requestId,
      userId: session.user.id,
    });
    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 500 });
  }

  logApiEvent("info", "checkout.session.created", {
    requestId,
    userId: session.user.id,
    pendingCheckoutId,
    totalCents: grandTotalCents,
  });

  return NextResponse.json({
    clientSecret,
    pendingCheckoutId,
    totalCents: grandTotalCents,
    discountCents: couponSummary?.discountCents ?? 0,
    appliedCouponCode: couponSummary?.code ?? null,
  });
}
