import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { listCoupons, toggleCouponActive } from "@/lib/coupons";

const updateCouponSchema = z.object({
  active: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SELLER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateCouponSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { id } = await params;
  const coupons = await listCoupons();
  const coupon = coupons.find((entry) => entry.id === id);
  if (!coupon) {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  }

  if (session.user.role === Role.SELLER && coupon.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await toggleCouponActive(id, parsed.data.active);
  return NextResponse.json({ coupon: updated });
}
