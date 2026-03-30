import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ProductStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { getProductMetaMap, getProductVariants, normalizeProductVariants, setProductMeta } from "@/lib/site-config";

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

const updateProductSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  priceCents: z.int().positive().optional(),
  stock: z.int().min(0).optional(),
  imageUrls: z.array(imageUrlSchema).optional(),
  status: z.enum(ProductStatus).optional(),
  category: z.string().trim().optional(),
  categories: z.array(z.string().trim().min(1)).max(10).optional(),
  materials: z.string().trim().max(300).optional(),
  dimensions: z.string().trim().max(200).optional(),
  variants: z.array(productVariantSchema).max(25).optional(),
  publishMode: z.enum(["now", "draft", "schedule"]).optional(),
  publishAt: z.string().datetime().optional(),
});

const LOW_STOCK_THRESHOLD = 5;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const product = await prisma.product.findUnique({
    where: { id },
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

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({ product });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  if (session.user.role !== Role.ADMIN && existing.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(json);
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

  const {
    category: rawCategory,
    categories: rawCategories,
    materials,
    dimensions,
    variants: rawVariants,
    publishMode,
    publishAt,
    ...productPatch
  } = parsed.data;
  const normalizedCategories = [
    ...(rawCategories ?? []),
    ...(rawCategory ? [rawCategory] : []),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const categories = [...new Set(normalizedCategories)];
  const category = categories[0];

  if (publishMode) {
    if (publishMode === "draft") {
      productPatch.status = ProductStatus.DELISTED;
    }
    if (publishMode === "schedule") {
      productPatch.status = ProductStatus.DELISTED;
    }
    if (publishMode === "now") {
      productPatch.status = ProductStatus.ACTIVE;
    }
  }

  if (publishAt && new Date(publishAt).getTime() <= Date.now()) {
    productPatch.status = ProductStatus.ACTIVE;
  }

  const product = await prisma.product.update({
    where: { id },
    data: productPatch,
  });

  if (
    rawCategory !== undefined ||
    rawCategories !== undefined ||
    materials !== undefined ||
    dimensions !== undefined ||
    rawVariants !== undefined ||
    publishMode !== undefined ||
    publishAt !== undefined
  ) {
    try {
      const variants = rawVariants !== undefined ? normalizeProductVariants(rawVariants) : undefined;

      await setProductMeta(id, {
        category,
        categories,
        materials,
        dimensions,
        variants,
        draft: publishMode === "draft" ? true : publishMode === "now" ? false : undefined,
        publishAt: publishMode === "schedule" ? publishAt : publishMode === "now" ? undefined : publishAt,
      });
    } catch (error) {
      // Metadata sync should not block product edits when auxiliary storage is unavailable.
      logApiEvent("warn", "products.patch.meta_sync_failed", {
        productId: id,
        sellerId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (typeof productPatch.stock === "number" && productPatch.stock <= LOW_STOCK_THRESHOLD) {
    await prisma.notification.create({
      data: {
        userId: existing.sellerId,
        type: "SYSTEM",
        title: "Low stock alert",
        body: `\"${product.title}\" is low in stock (${productPatch.stock} left).`,
        href: "/seller/products",
        productId: product.id,
      },
    });
  }

  const meta = await getProductMetaMap();

  return NextResponse.json({
    product: {
      ...product,
      variants: getProductVariants(meta[id]),
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  if (session.user.role !== Role.ADMIN && existing.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
