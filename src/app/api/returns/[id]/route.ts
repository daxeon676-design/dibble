import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { sendPreferenceAwareEmail } from "@/lib/preference-email";
import { prisma } from "@/lib/prisma";
import { getReturnRequestById, updateReturnRequest } from "@/lib/returns";

const patchSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "RECEIVED", "REFUNDED", "CLOSED"]).optional(),
  resolutionNote: z.string().trim().max(2000).optional(),
}).refine((value) => Boolean(value.status || value.resolutionNote), {
  message: "Provide at least one change.",
});

const allowedTransitions: Record<string, string[]> = {
  REQUESTED: ["APPROVED", "REJECTED", "CLOSED"],
  APPROVED: ["RECEIVED", "REJECTED", "CLOSED"],
  RECEIVED: ["REFUNDED", "CLOSED"],
  REFUNDED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const requestRow = await getReturnRequestById(id);
  if (!requestRow) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }

  const canView =
    session.user.role === Role.ADMIN ||
    requestRow.buyerId === session.user.id ||
    requestRow.sellerId === session.user.id;

  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ returnRequest: requestRow });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { id } = await params;
  const existing = await getReturnRequestById(id);
  if (!existing) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }

  if (session.user.role === Role.SELLER && existing.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.status && !allowedTransitions[existing.status]?.includes(parsed.data.status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${existing.status} to ${parsed.data.status}.` },
      { status: 409 },
    );
  }

  const next = await updateReturnRequest(id, {
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.resolutionNote ? { resolutionNote: parsed.data.resolutionNote } : {}),
    reviewedById: session.user.id,
    reviewedAt: new Date().toISOString(),
  });

  if (!next) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }

  if (session.user.role === Role.ADMIN) {
    await prisma.auditLog.create({
      data: {
        actorAdmin: session.user.id,
        action: "RETURN_REQUEST_UPDATED",
        targetType: "RETURN_REQUEST",
        targetId: next.id,
        details: JSON.stringify({
          status: parsed.data.status ?? null,
          resolutionNote: parsed.data.resolutionNote ?? null,
          orderId: next.orderId,
        }),
      },
    });
  }

  const [buyer, seller] = await Promise.all([
    prisma.user.findUnique({
      where: { id: next.buyerId },
      select: { id: true, email: true, displayName: true },
    }),
    prisma.user.findUnique({
      where: { id: next.sellerId },
      select: { id: true, email: true, displayName: true },
    }),
  ]);

  const statusText = next.status.replaceAll("_", " ").toLowerCase();
  const orderLabel = next.orderId.slice(0, 8).toUpperCase();
  const detailsText = next.resolutionNote ? `<p>Note: ${next.resolutionNote}</p>` : "";

  if (buyer && buyer.id !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: buyer.id,
        type: "ORDER_UPDATE",
        title: "Return request updated",
        body: `Your return request for order #${orderLabel} is now ${statusText}.`,
        href: "/buyer/returns",
      },
    });

    await sendPreferenceAwareEmail({
      userId: buyer.id,
      preferenceKey: "returnUpdates",
      to: buyer.email,
      subject: `Return update for order #${orderLabel}`,
      html: `<p>Hi ${buyer.displayName ?? buyer.email},</p><p>Your return request for order <strong>#${orderLabel}</strong> is now <strong>${statusText}</strong>.</p>${detailsText}`,
    });
  }

  if (seller && seller.id !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: seller.id,
        type: "ORDER_UPDATE",
        title: "Return request updated",
        body: `A return request for order #${orderLabel} is now ${statusText}.`,
        href: "/seller/returns",
      },
    });

    await sendPreferenceAwareEmail({
      userId: seller.id,
      preferenceKey: "returnUpdates",
      to: seller.email,
      subject: `Return update for order #${orderLabel}`,
      html: `<p>Hi ${seller.displayName ?? seller.email},</p><p>The return request for order <strong>#${orderLabel}</strong> is now <strong>${statusText}</strong>.</p>${detailsText}`,
    });
  }

  return NextResponse.json({ returnRequest: next });
}
