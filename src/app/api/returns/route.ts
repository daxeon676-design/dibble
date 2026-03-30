import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { OrderStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { sendPreferenceAwareEmail } from "@/lib/preference-email";
import { prisma } from "@/lib/prisma";
import { createReturnRequest, hasOpenReturnForOrder, listReturnRequests } from "@/lib/returns";

const createSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(5).max(200),
  details: z.string().trim().min(10).max(2500),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await listReturnRequests();
  const role = session.user.role;

  const filtered =
    role === Role.ADMIN
      ? rows
      : role === Role.SELLER
        ? rows.filter((row) => row.sellerId === session.user.id)
        : rows.filter((row) => row.buyerId === session.user.id);

  return NextResponse.json({ returns: filtered });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.BUYER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const targetOrder = await prisma.order.findFirst({
    where: {
      id: parsed.data.orderId,
      ...(session.user.role === Role.ADMIN ? {} : { buyerId: session.user.id }),
    },
    select: {
      id: true,
      status: true,
      buyerId: true,
      sellerId: true,
      payment: { select: { status: true } },
    },
  });

  if (!targetOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (targetOrder.status !== OrderStatus.DELIVERED) {
    return NextResponse.json({ error: "Returns are only available for delivered orders." }, { status: 409 });
  }

  if (targetOrder.payment?.status !== "SUCCEEDED") {
    return NextResponse.json({ error: "Order payment must be successful before requesting a return." }, { status: 409 });
  }

  const rows = await listReturnRequests();
  if (hasOpenReturnForOrder(rows, targetOrder.id)) {
    return NextResponse.json({ error: "An open return request already exists for this order." }, { status: 409 });
  }

  const created = await createReturnRequest({
    orderId: targetOrder.id,
    buyerId: targetOrder.buyerId,
    sellerId: targetOrder.sellerId,
    reason: parsed.data.reason,
    details: parsed.data.details,
    requestedByIp: request.headers.get("x-forwarded-for") ?? undefined,
  });

  const [buyer, seller] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetOrder.buyerId },
      select: { id: true, email: true, displayName: true },
    }),
    prisma.user.findUnique({
      where: { id: targetOrder.sellerId },
      select: { id: true, email: true, displayName: true },
    }),
  ]);

  const orderLabel = targetOrder.id.slice(0, 8).toUpperCase();

  if (seller) {
    await prisma.notification.create({
      data: {
        userId: seller.id,
        type: "ORDER_UPDATE",
        title: "New return request",
        body: `A buyer submitted a return request for order #${orderLabel}.`,
        href: "/seller/returns",
      },
    });

    await sendPreferenceAwareEmail({
      userId: seller.id,
      preferenceKey: "returnUpdates",
      to: seller.email,
      subject: `New return request for order #${orderLabel}`,
      html: `<p>Hi ${seller.displayName ?? seller.email},</p><p>A buyer has submitted a return request for order <strong>#${orderLabel}</strong>.</p><p>Reason: ${created.reason}</p><p>Open your returns queue to review and respond.</p>`,
    });
  }

  if (buyer) {
    await prisma.notification.create({
      data: {
        userId: buyer.id,
        type: "ORDER_UPDATE",
        title: "Return request submitted",
        body: `Your return request for order #${orderLabel} has been submitted.`,
        href: "/buyer/returns",
      },
    });

    await sendPreferenceAwareEmail({
      userId: buyer.id,
      preferenceKey: "returnUpdates",
      to: buyer.email,
      subject: `Return request received for order #${orderLabel}`,
      html: `<p>Hi ${buyer.displayName ?? buyer.email},</p><p>We received your return request for order <strong>#${orderLabel}</strong>.</p><p>Reason: ${created.reason}</p><p>We'll notify you when there is an update.</p>`,
    });
  }

  return NextResponse.json({ returnRequest: created }, { status: 201 });
}
