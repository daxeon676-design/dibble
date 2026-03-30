import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getCartItemMetaMap } from "@/lib/cart-item-meta";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cart = await prisma.cart.findUnique({
    where: { buyerId: session.user.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              seller: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!cart) {
    return NextResponse.json({ cart: null });
  }

  const metaByItemId = await getCartItemMetaMap(cart.items.map((item) => item.id));

  const enrichedCart = {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      variantId: metaByItemId[item.id]?.variantId ?? null,
      variantLabel: metaByItemId[item.id]?.variantLabel ?? null,
      variantPriceDeltaCents: metaByItemId[item.id]?.variantPriceDeltaCents ?? 0,
    })),
  };

  return NextResponse.json({ cart: enrichedCart });
}
