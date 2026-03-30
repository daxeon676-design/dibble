import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notifyDisputeResolution } from "@/lib/dispute-notifications";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const disputeInclude = {
  order: {
    select: {
      id: true,
      totalCents: true,
      createdAt: true,
      sellerId: true,
      payment: {
        select: {
          id: true,
          status: true,
          amountCents: true,
          refundAmountCents: true,
          refundedAt: true,
          stripeRefundId: true,
          refundReason: true,
        },
      },
      buyer: { select: { id: true, email: true, displayName: true } },
      seller: { select: { id: true, email: true, displayName: true } },
    },
  },
  raisedBy: { select: { id: true, email: true, displayName: true } },
  resolvedBy: { select: { id: true, email: true, displayName: true } },
  messages: {
    include: {
      sender: { select: { id: true, email: true, displayName: true, role: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

// GET /api/disputes/[id]
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: disputeInclude,
  });

  if (!dispute) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the buyer who raised it or an admin can view
  if (dispute.raisedById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(dispute);
}

const updateSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "CLOSED"]).optional(),
  resolution: z.string().max(2000).optional(),
}).refine((value) => Boolean(value.status || value.resolution?.trim()), {
  message: "Provide a status, a resolution note, or both.",
});

// PATCH /api/disputes/[id]  — admin only
export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const existing = await prisma.dispute.findUnique({
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

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextResolution = parsed.data.resolution?.trim();
  const shouldMarkResolved = parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED";

  const dispute = await prisma.$transaction(async (tx) => {
    const updated = await tx.dispute.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(nextResolution ? { resolution: nextResolution } : {}),
        ...(shouldMarkResolved
          ? {
              resolvedById: session.user.id,
              resolvedAt: new Date(),
            }
          : {}),
      },
      include: disputeInclude,
    });

    await tx.auditLog.create({
      data: {
        actorAdmin: session.user.id,
        action: "DISPUTE_UPDATED",
        targetType: "DISPUTE",
        targetId: updated.id,
        details: JSON.stringify({
          status: parsed.data.status ?? null,
          resolution: nextResolution ?? null,
        }),
      },
    });

    return updated;
  });

  if (nextResolution || shouldMarkResolved) {
    await notifyDisputeResolution({
      orderId: existing.order.id,
      reason: existing.reason,
      resolution: nextResolution ?? dispute.resolution ?? "Your dispute has been updated.",
      buyer: existing.order.buyer,
      seller: existing.order.seller,
    });
  }

  return NextResponse.json(dispute);
}
