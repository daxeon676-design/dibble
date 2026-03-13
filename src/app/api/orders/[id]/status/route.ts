import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { OrderStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import {
  canTransitionOrderStatus,
  requiresSuccessfulPaymentForStatus,
} from "@/lib/order-status";
import { prisma } from "@/lib/prisma";

const updateStatusSchema = z.object({
  status: z.enum([
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findUnique({ where: { id }, include: { payment: true } });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const isAdmin = session.user.role === Role.ADMIN;
  const isOrderSeller = order.sellerId === session.user.id;

  if (!isAdmin && !isOrderSeller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status payload." }, { status: 400 });
  }

  const nextStatus = parsed.data.status;

  if (!canTransitionOrderStatus(order.status, nextStatus)) {
    return NextResponse.json(
      { error: `Cannot move order from ${order.status} to ${nextStatus}.` },
      { status: 409 },
    );
  }

  if (requiresSuccessfulPaymentForStatus(nextStatus, order.payment?.status)) {
    return NextResponse.json(
      { error: "Cannot process order until payment is successful." },
      { status: 409 },
    );
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: parsed.data.status,
    },
  });

  return NextResponse.json({ order: updated });
}
