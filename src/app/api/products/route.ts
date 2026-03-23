import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ProductStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { getProductMetaMap, setProductMeta } from "@/lib/site-config";

const imageUrlSchema = z.string().refine(
  (v) => v.startsWith("/uploads/") || z.string().url().safeParse(v).success,
  { message: "Must be a URL or an /uploads/ path" },
);

const createProductSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(3000),
  priceCents: z.int().positive(),
  stock: z.int().min(0),
  imageUrls: z.array(imageUrlSchema).default([]),
  category: z.string().trim().min(1).optional(),
  materials: z.string().trim().max(300).optional(),
  dimensions: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sellerId = searchParams.get("sellerId");
  const mine = searchParams.get("mine") === "true";
  const status = searchParams.get("status") as ProductStatus | null;
  const category = searchParams.get("category")?.trim();

  if (mine) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: {
        sellerId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ products });
  }

  let products = await prisma.product.findMany({
    where: {
      sellerId: sellerId ?? undefined,
      status: status ?? ProductStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
    include: {
      seller: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (category) {
    const meta = await getProductMetaMap();
    products = products.filter((product) => (meta[product.id]?.category ?? "") === category);
  }

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Only sellers can create products." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product payload." }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      sellerId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priceCents: parsed.data.priceCents,
      stock: parsed.data.stock,
      imageUrls: parsed.data.imageUrls,
      status: ProductStatus.ACTIVE,
    },
  });

  try {
    await setProductMeta(product.id, {
      category: parsed.data.category,
      materials: parsed.data.materials,
      dimensions: parsed.data.dimensions,
    });

    // Notify followers that a new product was published.
    const followers = await prisma.sellerFollow.findMany({
      where: { sellerId: session.user.id },
      select: { buyerId: true },
    });

    if (followers.length > 0) {
      const sellerLabel = session.user.name ?? session.user.email ?? "A seller you follow";
      await prisma.notification.createMany({
        data: followers.map((follower) => ({
          userId: follower.buyerId,
          type: "NEW_PRODUCT",
          title: "New product from a followed shop",
          body: `${sellerLabel} listed \"${product.title}\"`,
          href: `/products/${product.id}`,
          productId: product.id,
          actorUserId: session.user.id,
        })),
      });
    }
  } catch (error) {
    logApiEvent("warn", "products.post.post_create_side_effect_failed", {
      productId: product.id,
      sellerId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json({ product }, { status: 201 });
}
