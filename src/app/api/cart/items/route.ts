import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ProductStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { getCartItemMeta, setCartItemMeta } from "@/lib/cart-item-meta";
import { prisma } from "@/lib/prisma";
import { getProductMetaMap, getProductVariant } from "@/lib/site-config";

const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.int().min(1).max(999).default(1),
  variantId: z.string().trim().min(1).max(64).nullable().optional(),
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

  const productMetaMap = await getProductMetaMap();
  const selectedVariant = getProductVariant(productMetaMap[product.id], parsed.data.variantId ?? null);
  const availableStock = selectedVariant?.stockOverride ?? product.stock;
  const unitPriceCents = product.priceCents + (selectedVariant?.priceDeltaCents ?? 0);

  if (availableStock < parsed.data.quantity) {
    return NextResponse.json({ error: "Not enough stock available for the selected variant." }, { status: 409 });
  }

  const cart =
    (await prisma.cart.findUnique({ where: { buyerId: session.user.id } })) ??
    (await prisma.cart.create({ data: { buyerId: session.user.id } }));

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
  });

  if (existing) {
    const existingMeta = await getCartItemMeta(existing.id);
    if ((existingMeta?.variantId ?? null) !== (selectedVariant?.id ?? null)) {
      return NextResponse.json(
        { error: "This product is already in your basket with a different variant. Remove it first to switch variants." },
        { status: 409 },
      );
    }

    const nextQty = existing.quantity + parsed.data.quantity;
    if (availableStock < nextQty) {
      return NextResponse.json({ error: "Not enough stock for requested total quantity." }, { status: 409 });
    }

    const item = await prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        quantity: nextQty,
        unitPriceCts: unitPriceCents,
      },
    });

    await setCartItemMeta(item.id, {
      variantId: selectedVariant?.id ?? null,
      variantLabel: selectedVariant?.label ?? null,
      variantPriceDeltaCents: selectedVariant?.priceDeltaCents ?? 0,
    });

    return NextResponse.json({ item });
  }

  const item = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: product.id,
      quantity: parsed.data.quantity,
      unitPriceCts: unitPriceCents,
    },
  });

  await setCartItemMeta(item.id, {
    variantId: selectedVariant?.id ?? null,
    variantLabel: selectedVariant?.label ?? null,
    variantPriceDeltaCents: selectedVariant?.priceDeltaCents ?? 0,
  });

  return NextResponse.json({ item }, { status: 201 });
}
