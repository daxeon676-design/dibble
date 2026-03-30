import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.BUYER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              stock: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (session.user.role !== Role.ADMIN && order.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cart = await prisma.cart.upsert({
    where: { buyerId: order.buyerId },
    update: {},
    create: { buyerId: order.buyerId },
  });

  for (const item of order.items) {
    if (item.product.status !== "ACTIVE" || item.product.stock <= 0) {
      continue;
    }

    const quantityToAdd = Math.min(item.quantity, item.product.stock);

    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: item.productId,
        },
      },
      select: { id: true, quantity: true },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: Math.max(1, Math.min(existing.quantity + quantityToAdd, item.product.stock)),
          unitPriceCts: item.unitPriceCents,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: item.productId,
          quantity: Math.max(1, quantityToAdd),
          unitPriceCts: item.unitPriceCents,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
