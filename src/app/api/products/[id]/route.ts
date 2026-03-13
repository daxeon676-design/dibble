import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ProductStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setProductMeta } from "@/lib/site-config";

const imageUrlSchema = z.string().refine(
  (v) => v.startsWith("/uploads/") || z.string().url().safeParse(v).success,
  { message: "Must be a URL or an /uploads/ path" },
);

const updateProductSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  priceCents: z.int().positive().optional(),
  stock: z.int().min(0).optional(),
  imageUrls: z.array(imageUrlSchema).optional(),
  status: z.enum(ProductStatus).optional(),
  category: z.string().trim().min(1).optional(),
  materials: z.string().trim().max(300).optional(),
  dimensions: z.string().trim().max(200).optional(),
});

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
    return NextResponse.json({ error: "Invalid product payload." }, { status: 400 });
  }

  const { category, materials, dimensions, ...productPatch } = parsed.data;

  const product = await prisma.product.update({
    where: { id },
    data: productPatch,
  });

  if (category !== undefined || materials !== undefined || dimensions !== undefined) {
    await setProductMeta(id, { category, materials, dimensions });
  }

  return NextResponse.json({ product });
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
