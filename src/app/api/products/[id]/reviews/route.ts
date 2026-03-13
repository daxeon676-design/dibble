import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { PaymentStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(1000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.BUYER) {
    return NextResponse.json({ error: "Only buyers can leave reviews." }, { status: 403 });
  }

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = createReviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
  }

  const hasPurchased = await prisma.order.findFirst({
    where: {
      buyerId: session.user.id,
      payment: { status: PaymentStatus.SUCCEEDED },
      items: {
        some: { productId: id },
      },
    },
    select: { id: true },
  });

  if (!hasPurchased) {
    return NextResponse.json({ error: "You can only review products you have purchased." }, { status: 403 });
  }

  const review = await prisma.review.upsert({
    where: {
      productId_buyerId: {
        productId: id,
        buyerId: session.user.id,
      },
    },
    create: {
      productId: id,
      buyerId: session.user.id,
      rating: parsed.data.rating,
      body: parsed.data.body,
    },
    update: {
      rating: parsed.data.rating,
      body: parsed.data.body,
    },
  });

  return NextResponse.json({ review }, { status: 201 });
}