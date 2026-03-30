import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { createCoupon, listCoupons, listCouponsBySeller } from "@/lib/coupons";

const createCouponSchema = z.object({
  code: z.string().trim().min(3).max(32),
  type: z.enum(["PERCENT", "FIXED"]),
  amount: z.number().positive(),
  minOrderCents: z.number().int().min(0).optional(),
  maxDiscountCents: z.number().int().min(1).nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  sellerId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === Role.ADMIN) {
    const coupons = await listCoupons();
    return NextResponse.json({ coupons });
  }

  if (session.user.role === Role.SELLER) {
    const coupons = await listCouponsBySeller(session.user.id);
    return NextResponse.json({ coupons });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SELLER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createCouponSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (session.user.role === Role.SELLER && parsed.data.sellerId && parsed.data.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Sellers can only create their own coupons." }, { status: 403 });
  }

  const coupon = await createCoupon({
    ...parsed.data,
    sellerId: session.user.role === Role.SELLER ? session.user.id : parsed.data.sellerId,
    createdByUserId: session.user.id,
  }).catch((error) => {
    return { error: error instanceof Error ? error.message : "Could not create coupon." };
  });

  if ("error" in coupon) {
    return NextResponse.json(coupon, { status: 409 });
  }

  return NextResponse.json({ coupon }, { status: 201 });
}
