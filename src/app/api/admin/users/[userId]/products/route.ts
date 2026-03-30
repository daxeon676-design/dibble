import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/users/[userId]/products
 *
 * Bulk-removes all products for a user:
 *  - Hard-deletes products with no order history
 *  - Delists products that have order history (preserves OrderItem references)
 *
 * Returns counts of deleted and delisted products.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;

  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const products = await prisma.product.findMany({
    where: { sellerId: userId },
    select: {
      id: true,
      title: true,
      _count: { select: { orderItems: true } },
    },
  });

  if (products.length === 0) {
    return NextResponse.json({ deleted: 0, delisted: 0 });
  }

  const idsWithOrders = products.filter((p) => p._count.orderItems > 0).map((p) => p.id);
  const idsWithoutOrders = products.filter((p) => p._count.orderItems === 0).map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    if (idsWithOrders.length > 0) {
      await tx.product.updateMany({
        where: { id: { in: idsWithOrders } },
        data: { status: "DELISTED" },
      });
    }
    if (idsWithoutOrders.length > 0) {
      await tx.product.deleteMany({ where: { id: { in: idsWithoutOrders } } });
    }
    await tx.auditLog.create({
      data: {
        actorAdmin: session.user.id,
        action: "USER_PRODUCTS_CLEARED",
        targetType: "User",
        targetId: userId,
        details: JSON.stringify({
          deleted: idsWithoutOrders.length,
          delisted: idsWithOrders.length,
        }),
      },
    });
  });

  logApiEvent("info", "admin.user.products_cleared", {
    actorId: session.user.id,
    targetUserId: userId,
    deleted: idsWithoutOrders.length,
    delisted: idsWithOrders.length,
  });

  return NextResponse.json({ deleted: idsWithoutOrders.length, delisted: idsWithOrders.length });
}
