import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role, SellerApplicationStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { appBaseUrl } from "@/lib/email";
import { sendPreferenceAwareEmail } from "@/lib/preference-email";
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

  // Send notification email to the applicant
  const applicant = await prisma.user.findUnique({
    where: { id: updated.userId },
    select: { email: true, displayName: true },
  });

  if (applicant) {
    const base = appBaseUrl();
    if (approved) {
      await sendPreferenceAwareEmail({
        userId: updated.userId,
        preferenceKey: "accountUpdates",
        to: applicant.email,
        subject: "Your Dibble seller application has been approved!",
        html: `
          <p>Hi ${applicant.displayName ?? applicant.email},</p>
          <p>Great news — your application to sell on Dibble has been <strong>approved</strong>.</p>
          <p>Your seller account is now active. Head to your <a href="${base}/seller">Seller Dashboard</a> to set up your shop, add products, and configure your delivery options.</p>
          <p>Here is a quick checklist to get started:</p>
          <ol>
            <li><a href="${base}/seller/settings">Add your shop logo and description</a></li>
            <li><a href="${base}/seller/delivery-options">Set up a delivery option</a></li>
            <li><a href="${base}/seller/products/new">List your first product</a></li>
            <li><a href="${base}/seller/payouts-help">Set up your payout method</a></li>
          </ol>
          <p>If you have any questions, just reply to this email.</p>
          <p>Welcome aboard,<br/>The Dibble team</p>
        `,
      });
    } else {
      await sendPreferenceAwareEmail({
        userId: updated.userId,
        preferenceKey: "accountUpdates",
        to: applicant.email,
        subject: "Update on your Dibble seller application",
        html: `
          <p>Hi ${applicant.displayName ?? applicant.email},</p>
          <p>Thank you for applying to sell on Dibble. Unfortunately, after review, we are not able to approve your application at this time.</p>
          ${parsed.data.reviewNotes ? `<p><strong>Reason:</strong> ${parsed.data.reviewNotes}</p>` : ""}
          <p>If you believe this decision was made in error or you would like to discuss it, please reply to this email.</p>
          <p>The Dibble team</p>
        `,
      });
    }
  }

  return NextResponse.json({ application: updated });
}
