import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { getCartItemMetaMap } from "@/lib/cart-item-meta";
import { calculateOrderTotalCents, groupCartItemsBySeller } from "@/lib/checkout";
import { prisma } from "@/lib/prisma";
import { CheckoutClient } from "./checkout-client";
import {
  getSiteConfig,
  getSellerDeliverySettingsMap,
  resolveSellerDeliveryCostPence,
} from "@/lib/site-config";
import { getOrCreateStripeCustomer, stripe } from "@/lib/stripe";

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/buyer/checkout");
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
              priceCents: true,
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    redirect("/buyer/cart?error=empty");
  }

  const cartMetaByItemId = await getCartItemMetaMap(cart.items.map((item) => item.id));
  const enrichedCart = {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      variantId: cartMetaByItemId[item.id]?.variantId ?? null,
      variantLabel: cartMetaByItemId[item.id]?.variantLabel ?? null,
      variantPriceDeltaCents: cartMetaByItemId[item.id]?.variantPriceDeltaCents ?? 0,
    })),
  };

  const [config, sellerDeliveryMap] = await Promise.all([
    getSiteConfig(),
    getSellerDeliverySettingsMap(),
  ]);

  const enabledOptions = config.deliveryOptions.filter((option) => option.enabled);
  const groupedItems = groupCartItemsBySeller(enrichedCart.items);

  const deliveryOptions = enabledOptions.map((option) => {
    let costPence = 0;
    for (const [sellerId, items] of groupedItems.entries()) {
      const sellerSettings = sellerDeliveryMap[sellerId] ?? {
        optionIds: enabledOptions.map((opt) => opt.id),
        customCostsPence: {},
        freeDeliveryThresholdPence: 0,
      };
      costPence += resolveSellerDeliveryCostPence(
        sellerSettings,
        option.id,
        option.costPence,
        calculateOrderTotalCents(items),
      );
    }

    return {
      ...option,
      costPence,
    };
  });
  const [user, savedAddresses] = await Promise.all([
    prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      displayName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postcode: true,
      country: true,
    },
    }),
    prisma.savedAddress.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        fullName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        country: true,
        isDefault: true,
      },
    }),
  ]);

  let savedPaymentMethods: Array<{ id: string; brand: string; last4: string; expMonth: number; expYear: number }> = [];

  if (stripe && session.user.email) {
    const customer = await getOrCreateStripeCustomer({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });

    if (customer?.id) {
      const cards = await stripe.paymentMethods.list({
        customer: customer.id,
        type: "card",
        limit: 10,
      });
      savedPaymentMethods = cards.data
        .filter((pm) => pm.card)
        .map((pm) => ({
          id: pm.id,
          brand: pm.card?.brand ?? "card",
          last4: pm.card?.last4 ?? "****",
          expMonth: pm.card?.exp_month ?? 0,
          expYear: pm.card?.exp_year ?? 0,
        }));
    }
  }

  return (
    <CheckoutClient
      initialCart={enrichedCart}
      initialUser={user}
      initialSavedAddresses={savedAddresses}
      initialSavedPaymentMethods={savedPaymentMethods}
      deliveryOptions={deliveryOptions}
    />
  );
}
