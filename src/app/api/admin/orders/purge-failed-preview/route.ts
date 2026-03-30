import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      dispute: null,
    },
    select: {
      id: true,
      totalCents: true,
      createdAt: true,
      buyer: { select: { email: true } },
      seller: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  return NextResponse.json({
    count: orders.length,
    sample: orders.slice(0, 10).map((o) => ({
      id: o.id,
      buyerEmail: o.buyer.email,
      sellerEmail: o.seller.email,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
    })),
  });
}
