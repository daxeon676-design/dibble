import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckoutClient } from "./checkout-client";
import { getSiteConfig } from "@/lib/site-config";

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

  const config = await getSiteConfig();
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
      deliveryOptions={config.deliveryOptions}
    />
  );
}
