import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig, getSellerDeliveryOptionsMap } from "@/lib/site-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cart = await prisma.cart.findUnique({
    where: { buyerId: session.user.id },
    include: { items: { include: { product: { select: { sellerId: true } } } } },
  });

  const sellerIds = [...new Set((cart?.items ?? []).map((item) => item.product.sellerId))];
  const config = await getSiteConfig();
  const map = await getSellerDeliveryOptionsMap();

  const enabled = config.deliveryOptions.filter((o) => o.enabled);
  const allowedByAll = enabled.filter((option) => {
    if (sellerIds.length === 0) return true;
    return sellerIds.every((sellerId) => {
      const offered = map[sellerId] ?? enabled.map((o) => o.id);
      return offered.includes(option.id);
    });
  });

  return NextResponse.json({ options: allowedByAll });
}
