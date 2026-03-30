import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/seller/products/[productId]/renew
 *
 * Resets the 12-month listing clock for a product:
 *  - Sets listedAt = now()
 *  - Clears renewalNotifiedAt
 *
 * Only the owning seller (or an admin) may renew a product.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productId } = await context.params;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sellerId: true, title: true, status: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  if (session.user.role !== Role.ADMIN && product.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      listedAt: new Date(),
      renewalNotifiedAt: null,
      // Re-activate delisted products when seller explicitly renews
      status: product.status === "DELISTED" ? "ACTIVE" : product.status,
    },
    select: { id: true, listedAt: true, renewalNotifiedAt: true, status: true },
  });

  return NextResponse.json({ product: updated });
}
