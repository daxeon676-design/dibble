import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      displayName: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (user.role === Role.ADMIN) {
    return NextResponse.json({
      canPurge: false,
      blocker: "Admin accounts cannot be purged.",
      user,
    });
  }

  const [openDisputes, activeOrders, products, pendingCheckouts, notifications, savedAddresses] = await Promise.all([
    prisma.dispute.count({
      where: {
        raisedById: userId,
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
    }),
    prisma.order.count({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: { in: ["PROCESSING", "SHIPPED"] },
      },
    }),
    prisma.product.findMany({
      where: { sellerId: userId },
      select: {
        id: true,
        title: true,
        _count: { select: { orderItems: true } },
      },
      take: 25,
      orderBy: { createdAt: "desc" },
    }),
    prisma.pendingCheckout.count({ where: { buyerId: userId } }),
    prisma.notification.count({ where: { userId } }),
    prisma.savedAddress.count({ where: { userId } }),
  ]);

  const productsWithOrders = products.filter((p) => p._count.orderItems > 0);
  const productsWithoutOrders = products.filter((p) => p._count.orderItems === 0);

  const canPurge = openDisputes === 0 && activeOrders === 0;

  return NextResponse.json({
    canPurge,
    blocker: !canPurge
      ? openDisputes > 0
        ? "User has open disputes. Resolve them before purging."
        : "User has in-progress orders. Complete or cancel them before purging."
      : null,
    user,
    impact: {
      productsDeleteCount: productsWithoutOrders.length,
      productsDelistCount: productsWithOrders.length,
      pendingCheckouts,
      notifications,
      savedAddresses,
      sampleProductsToDelete: productsWithoutOrders.slice(0, 5).map((p) => p.title),
      sampleProductsToDelist: productsWithOrders.slice(0, 5).map((p) => p.title),
    },
  });
}
