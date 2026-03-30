import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { getCartItemMetaMap } from "@/lib/cart-item-meta";
import { prisma } from "@/lib/prisma";
import { BuyerCartClient } from "@/app/buyer/cart/cart-client";

export default async function BuyerCartPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/buyer/cart");
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
              stock: true,
              imageUrls: true,
            },
          },
        },
      },
    },
  });

  const metaByItemId = cart ? await getCartItemMetaMap(cart.items.map((item) => item.id)) : {};

  const enrichedCart = cart
    ? {
        ...cart,
        items: cart.items.map((item) => ({
          ...item,
          variantId: metaByItemId[item.id]?.variantId ?? null,
          variantLabel: metaByItemId[item.id]?.variantLabel ?? null,
          variantPriceDeltaCents: metaByItemId[item.id]?.variantPriceDeltaCents ?? 0,
        })),
      }
    : null;

  return <BuyerCartClient initialCart={enrichedCart} />;
}
