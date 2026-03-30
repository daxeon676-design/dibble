/**
 * Payout notification service - sends alerts for payout status changes
 */

import { prisma } from "@/lib/prisma";
import { appBaseUrl, sendEmail } from "@/lib/email";

export type PayoutNotificationType =
  | "payout_pending"
  | "payout_processing"
  | "payout_succeeded"
  | "payout_failed"
  | "payout_delayed";

interface NotificationPayload {
  sellerId: string;
  type: PayoutNotificationType;
  payoutId: string;
  amountCents?: number;
  failureReason?: string;
  email?: string;
}

export async function sendPayoutNotification(payload: NotificationPayload) {
  try {
    // Create in-app notification
    const seller = await prisma.user.findUnique({
      where: { id: payload.sellerId },
      select: { id: true, email: true, displayName: true },
    });

    if (!seller) return;

    const titleMap: Record<PayoutNotificationType, string> = {
      payout_pending: "Payout Queued",
      payout_processing: "Payout Processing",
      payout_succeeded: "Payout Completed",
      payout_failed: "Payout Failed",
      payout_delayed: "Payout Delayed",
    };

    const bodyMap: Record<PayoutNotificationType, (amount?: number, reason?: string) => string> = {
      payout_pending: (amount) =>
        `Your payout of £${(amount! / 100).toFixed(2)} is queued for processing`,
      payout_processing: (amount) =>
        `Your payout of £${(amount! / 100).toFixed(2)} is being processed`,
      payout_succeeded: (amount) =>
        `Your payout of £${(amount! / 100).toFixed(2)} has been delivered to your account`,
      payout_failed: (amount, reason) =>
        `Your payout of £${(amount! / 100).toFixed(2)} failed: ${reason || "Please contact support"}`,
      payout_delayed: (amount) =>
        `Your payout of £${(amount! / 100).toFixed(2)} is delayed. We're investigating`,
    };

    await prisma.notification.create({
      data: {
        userId: payload.sellerId,
        type: "SYSTEM",
        title: titleMap[payload.type],
        body: bodyMap[payload.type](payload.amountCents, payload.failureReason),
        href: "/seller",
      },
    });

    // Send email notification
    await sendPayoutEmail({
      email: payload.email || seller.email,
      name: seller.displayName || seller.email,
      type: payload.type,
      amountCents: payload.amountCents,
      failureReason: payload.failureReason,
    });

    return { success: true };
  } catch (error) {
    console.error("Payout notification error:", error);
    return { success: false, error };
  }
}

async function sendPayoutEmail({
  email,
  name,
  type,
  amountCents,
  failureReason,
}: {
  email: string;
  name: string;
  type: PayoutNotificationType;
  amountCents?: number;
  failureReason?: string;
}) {
  const base = appBaseUrl();
  const sellerLink = `${base}/seller`;
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@dibblemarketplace.com";
  const amount = amountCents !== undefined ? `£${(amountCents / 100).toFixed(2)}` : "your payout";

  const subjectMap: Record<PayoutNotificationType, string> = {
    payout_pending: "Your payout has been queued",
    payout_processing: "Your payout is being processed",
    payout_succeeded: "Your payout has been delivered",
    payout_failed: "Your payout failed",
    payout_delayed: "Your payout is delayed",
  };

  const bodyMap: Record<PayoutNotificationType, string> = {
    payout_pending: `<p>Hi ${name},</p><p>Your payout of <strong>${amount}</strong> has been queued and will be processed within 3–5 business days.</p>`,
    payout_processing: `<p>Hi ${name},</p><p>Your payout of <strong>${amount}</strong> is currently being processed.</p>`,
    payout_succeeded: `<p>Hi ${name},</p><p>Great news! Your payout of <strong>${amount}</strong> has been successfully delivered to your account.</p>`,
    payout_failed: `<p>Hi ${name},</p><p>Unfortunately, your payout of <strong>${amount}</strong> failed${failureReason ? `: ${failureReason}` : ""}.</p><p>Please update your payout details or <a href="mailto:${supportEmail}">contact support</a>.</p>`,
    payout_delayed: `<p>Hi ${name},</p><p>Your payout of <strong>${amount}</strong> is taking longer than usual. We're investigating and will update you soon.</p><p>Need help? <a href="mailto:${supportEmail}">Contact support</a>.</p>`,
  };

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#333;max-width:520px;margin:auto;padding:24px">
    ${bodyMap[type]}
    <p><a href="${sellerLink}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#8B5C2A;color:#fff;border-radius:6px;text-decoration:none">View payout history</a></p>
    <p style="margin-top:24px;font-size:12px;color:#999">Dibble Marketplace · <a href="mailto:${supportEmail}">${supportEmail}</a></p>
  </body></html>`;

  await sendEmail({ to: email, subject: subjectMap[type], html });
}
