import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role, SellerApplicationStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reviewNotes: z.string().trim().max(1000).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
  }

  const existing = await prisma.sellerApplication.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (existing.status !== SellerApplicationStatus.PENDING) {
    return NextResponse.json({ error: "Application has already been reviewed." }, { status: 409 });
  }

  const approved = parsed.data.decision === "APPROVE";

  if (approved) {
    const siteConfig = await getSiteConfig();
    const activeSellerCount = await prisma.user.count({ where: { role: Role.SELLER } });
    if (activeSellerCount >= siteConfig.maxActiveSellerAccounts) {
      return NextResponse.json(
        { error: "Cannot approve application: seller account limit reached." },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const application = await tx.sellerApplication.update({
      where: { id },
      data: {
        status: approved ? SellerApplicationStatus.APPROVED : SellerApplicationStatus.REJECTED,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: parsed.data.reviewNotes,
      },
    });

    if (approved) {
      await tx.user.update({
        where: { id: application.userId },
        data: { role: Role.SELLER },
      });
    }

    await tx.auditLog.create({
      data: {
        actorAdmin: session.user.id,
        action: approved ? "SELLER_APPLICATION_APPROVED" : "SELLER_APPLICATION_REJECTED",
        targetType: "SellerApplication",
        targetId: id,
        details: parsed.data.reviewNotes,
      },
    });

    return application;
  });

  return NextResponse.json({ application: updated });
}
