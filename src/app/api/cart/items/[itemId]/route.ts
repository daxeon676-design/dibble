import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { deleteCartItemMeta } from "@/lib/cart-item-meta";
import { prisma } from "@/lib/prisma";

const updateQuantitySchema = z.object({
  quantity: z.int().min(1).max(999),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = updateQuantitySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: true, product: true },
  });

  if (!item || item.cart.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Cart item not found." }, { status: 404 });
  }

  if (item.product.stock < parsed.data.quantity) {
    return NextResponse.json({ error: "Not enough stock available." }, { status: 409 });
  }

  const updated = await prisma.cartItem.update({
    where: { id: itemId },
    data: {
      quantity: parsed.data.quantity,
      unitPriceCts: item.product.priceCents,
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await context.params;
  const item = await prisma.cartItem.findUnique({ where: { id: itemId }, include: { cart: true } });

  if (!item || item.cart.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Cart item not found." }, { status: 404 });
  }

  await prisma.cartItem.delete({ where: { id: itemId } });
  await deleteCartItemMeta(itemId);

  return NextResponse.json({ success: true });
}
