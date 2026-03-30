import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ProductStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { sendPreferenceAwareEmail } from "@/lib/preference-email";
import { prisma } from "@/lib/prisma";
import {
  getProductCategories,
  getProductMetaMap,
  getProductVariants,
  isProductPublished,
  normalizeProductVariants,
  setProductMeta,
} from "@/lib/site-config";

const imageUrlSchema = z.string().refine(
  (v) => v.startsWith("/uploads/") || v.startsWith("data:image/") || z.string().url().safeParse(v).success,
  { message: "Must be a URL, data URL, or an /uploads/ path" },
);

const productVariantSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  priceDeltaCents: z.int().min(-100000).max(100000),
  stockOverride: z.int().min(0).nullable().optional(),
  sku: z.string().trim().max(64).nullable().optional(),
});

const createProductSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(3000),
  priceCents: z.int().positive(),
  stock: z.int().min(0),
  imageUrls: z.array(imageUrlSchema).default([]),
  category: z.string().trim().optional(),
  categories: z.array(z.string().trim().min(1)).max(10).optional(),
  materials: z.string().trim().max(300).optional(),
  dimensions: z.string().trim().max(200).optional(),
  variants: z.array(productVariantSchema).max(25).optional(),
  publishMode: z.enum(["now", "draft", "schedule"]).default("now"),
  publishAt: z.string().datetime().optional(),
});

const LOW_STOCK_THRESHOLD = 5;

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

  const meta = await getProductMetaMap();

  const dueScheduled = products.filter((product) => {
    const productMeta = meta[product.id];
    if (!productMeta?.publishAt || product.status !== ProductStatus.DELISTED) {
      return false;
    }
    const publishAt = new Date(productMeta.publishAt);
    return !Number.isNaN(publishAt.getTime()) && publishAt.getTime() <= Date.now();
  });

  if (dueScheduled.length > 0) {
    await prisma.product.updateMany({
      where: { id: { in: dueScheduled.map((p) => p.id) } },
      data: { status: ProductStatus.ACTIVE },
    });

    await Promise.all(
      dueScheduled.map((product) =>
        setProductMeta(product.id, {
          draft: false,
          publishAt: undefined,
        }),
      ),
    );

    products = await prisma.product.findMany({
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
  }

  if (category) {
    products = products.filter((product) => getProductCategories(meta[product.id]).includes(category));
  }

  products = products.filter((product) => isProductPublished(meta[product.id]));

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
    return NextResponse.json(
      {
        error: "Invalid product payload.",
        issue: parsed.error.issues[0]?.message,
        field: parsed.error.issues[0]?.path?.join("."),
      },
      { status: 400 },
    );
  }

  const product = await prisma.product.create({
    data: {
      sellerId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priceCents: parsed.data.priceCents,
      stock: parsed.data.stock,
      imageUrls: parsed.data.imageUrls,
      status:
        parsed.data.publishMode === "now" &&
        (!parsed.data.publishAt || new Date(parsed.data.publishAt).getTime() <= Date.now())
          ? ProductStatus.ACTIVE
          : ProductStatus.DELISTED,
    },
  });

  try {
    const normalizedCategories = [
      ...(parsed.data.categories ?? []),
      ...(parsed.data.category ? [parsed.data.category] : []),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const categories = [...new Set(normalizedCategories)];
    const variants = normalizeProductVariants(parsed.data.variants);

    await setProductMeta(product.id, {
      category: categories[0],
      categories,
      materials: parsed.data.materials,
      dimensions: parsed.data.dimensions,
      variants,
      draft: parsed.data.publishMode === "draft",
      publishAt: parsed.data.publishMode === "schedule" ? parsed.data.publishAt : undefined,
    });

    if (parsed.data.stock <= LOW_STOCK_THRESHOLD) {
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: "SYSTEM",
          title: "Low stock alert",
          body: `\"${product.title}\" is low in stock (${parsed.data.stock} left).`,
          href: "/seller/products",
          productId: product.id,
        },
      });
    }

    // Notify followers that a new product was published.
    const followers = await prisma.sellerFollow.findMany({
      where: { sellerId: session.user.id },
      select: { buyerId: true },
    });

    const isPublishedNow =
      parsed.data.publishMode === "now" &&
      (!parsed.data.publishAt || new Date(parsed.data.publishAt).getTime() <= Date.now());

    if (followers.length > 0 && isPublishedNow) {
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

      const followerUsers = await prisma.user.findMany({
        where: { id: { in: followers.map((follower) => follower.buyerId) } },
        select: { id: true, email: true, displayName: true },
      });

      await Promise.allSettled(
        followerUsers.map(async (follower) => {
          await sendPreferenceAwareEmail({
            userId: follower.id,
            preferenceKey: "productAnnouncements",
            to: follower.email,
            subject: `New item from ${sellerLabel} on Dibble`,
            html: `<p>Hi ${follower.displayName ?? follower.email},</p><p>${sellerLabel} just listed a new item: <strong>${product.title}</strong>.</p><p><a href="https://dibble.farm/products/${product.id}">View product</a></p>`,
          });
        }),
      );
    }
  } catch (error) {
    logApiEvent("warn", "products.post.post_create_side_effect_failed", {
      productId: product.id,
      sellerId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const meta = await getProductMetaMap();

  return NextResponse.json(
    {
      product: {
        ...product,
        variants: getProductVariants(meta[product.id]),
      },
    },
    { status: 201 },
  );
}
