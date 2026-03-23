import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { calculateOrderTotalCents, groupCartItemsBySeller } from "@/lib/checkout";
import { prisma } from "@/lib/prisma";
import { CheckoutClient } from "./checkout-client";
import {
  getSiteConfig,
  getSellerDeliverySettingsMap,
  resolveSellerDeliveryCostPence,
} from "@/lib/site-config";

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

  const [config, sellerDeliveryMap] = await Promise.all([
    getSiteConfig(),
    getSellerDeliverySettingsMap(),
  ]);

  const enabledOptions = config.deliveryOptions.filter((option) => option.enabled);
  const groupedItems = groupCartItemsBySeller(cart.items);

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

  return (
    <CheckoutClient
      initialCart={cart}
      initialUser={user}
      initialSavedAddresses={savedAddresses}
      deliveryOptions={deliveryOptions}
    />
  );
}
