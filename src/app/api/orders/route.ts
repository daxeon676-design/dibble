import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { getRequestId, logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where =
    session.user.role === Role.ADMIN
      ? {}
      : session.user.role === Role.SELLER
        ? { sellerId: session.user.id }
        : { buyerId: session.user.id };

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: {
        include: {
          product: {
            select: {
              title: true,
              description: true,
            },
          },
        },
      },
      buyer: {
        select: {
          email: true,
          displayName: true,
        },
      },
      seller: {
        select: {
          email: true,
          displayName: true,
        },
      },
      payment: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    logApiEvent("warn", "orders.create.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logApiEvent("warn", "orders.create.legacy_endpoint_blocked", {
    requestId,
    userId: session.user.id,
  });

  return NextResponse.json(
    {
      error: "Direct order creation is disabled. Use /api/checkout/session and /api/checkout/confirm.",
    },
    { status: 410 },
  );
}
