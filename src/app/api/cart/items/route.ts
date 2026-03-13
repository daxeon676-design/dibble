import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ProductStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.int().min(1).max(999).default(1),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = addItemSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product || product.status !== ProductStatus.ACTIVE) {
    return NextResponse.json({ error: "Product is unavailable." }, { status: 404 });
  }

  if (product.stock < parsed.data.quantity) {
    return NextResponse.json({ error: "Not enough stock available." }, { status: 409 });
  }

  const cart =
    (await prisma.cart.findUnique({ where: { buyerId: session.user.id } })) ??
    (await prisma.cart.create({ data: { buyerId: session.user.id } }));

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
  });

  if (existing) {
    const nextQty = existing.quantity + parsed.data.quantity;
    if (product.stock < nextQty) {
      return NextResponse.json({ error: "Not enough stock for requested total quantity." }, { status: 409 });
    }

    const item = await prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        quantity: nextQty,
        unitPriceCts: product.priceCents,
      },
    });

    return NextResponse.json({ item });
  }

  const item = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: product.id,
      quantity: parsed.data.quantity,
      unitPriceCts: product.priceCents,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
