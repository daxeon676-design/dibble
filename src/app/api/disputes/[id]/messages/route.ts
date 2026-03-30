import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { notifyDisputeReply } from "@/lib/dispute-notifications";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().trim().min(2).max(4000),
});

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          buyer: { select: { id: true, email: true, displayName: true } },
          seller: { select: { id: true, email: true, displayName: true } },
        },
      },
    },
  });

  if (!dispute) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await prisma.$transaction(async (tx) => {
    if (dispute.status === "OPEN") {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: { status: "UNDER_REVIEW" },
      });
    }

    const created = await tx.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: session.user.id,
        body: parsed.data.body,
      },
      include: {
        sender: { select: { id: true, email: true, displayName: true, role: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        actorAdmin: session.user.id,
        action: "DISPUTE_MESSAGE_POSTED",
        targetType: "DISPUTE",
        targetId: dispute.id,
        details: JSON.stringify({
          messageId: created.id,
        }),
      },
    });

    return created;
  });

  await notifyDisputeReply({
    disputeId: dispute.id,
    orderId: dispute.order.id,
    reason: dispute.reason,
    buyer: dispute.order.buyer,
    seller: dispute.order.seller,
    adminName: session.user.name?.trim() || session.user.email || "Dibble support",
  });

  return NextResponse.json(message, { status: 201 });
}