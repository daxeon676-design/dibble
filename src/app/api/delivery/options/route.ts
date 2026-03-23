import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { calculateOrderTotalCents, groupCartItemsBySeller } from "@/lib/checkout";
import { prisma } from "@/lib/prisma";
import {
  getSiteConfig,
  getSellerDeliverySettingsMap,
  resolveSellerDeliveryCostPence,
} from "@/lib/site-config";

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
  const map = await getSellerDeliverySettingsMap();

  const enabled = config.deliveryOptions.filter((o) => o.enabled);
  const allowedByAll = enabled.filter((option) => {
    if (sellerIds.length === 0) return true;
    return sellerIds.every((sellerId) => {
      const offered = map[sellerId]?.optionIds ?? enabled.map((o) => o.id);
      return offered.includes(option.id);
    });
  });

  const grouped = groupCartItemsBySeller(cart?.items ?? []);
  const options = allowedByAll.map((option) => {
    let totalCostPence = 0;
    for (const [sellerId, items] of grouped.entries()) {
      const sellerSettings = map[sellerId] ?? {
        optionIds: enabled.map((o) => o.id),
        customCostsPence: {},
        freeDeliveryThresholdPence: 0,
      };
      totalCostPence += resolveSellerDeliveryCostPence(
        sellerSettings,
        option.id,
        option.costPence,
        calculateOrderTotalCents(items),
      );
    }

    return {
      ...option,
      costPence: totalCostPence,
    };
  });

  return NextResponse.json({ options });
}
