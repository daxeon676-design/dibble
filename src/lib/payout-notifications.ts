/**
 * Payout notification service - sends alerts for payout status changes
 */

import { prisma } from "@/lib/prisma";

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
  // In production, integrate with Resend or SendGrid
  // This is a placeholder for the email sending logic
  const emailTemplates: Record<PayoutNotificationType, string> = {
    payout_pending: `Hi ${name},\n\nYour payout of £${(amountCents! / 100).toFixed(2)} has been queued and will be processed within 3-5 business days.\n\nView your payout history: https://dibble.farm/seller`,
    payout_processing: `Hi ${name},\n\nYour payout of £${(amountCents! / 100).toFixed(2)} is currently being processed.\n\nView your payout history: https://dibble.farm/seller`,
    payout_succeeded: `Hi ${name},\n\nGreat news! Your payout of £${(amountCents! / 100).toFixed(2)} has been successfully delivered to your account.\n\nView your payout history: https://dibble.farm/seller`,
    payout_failed: `Hi ${name},\n\nUnfortunately, your payout of £${(amountCents! / 100).toFixed(2)} failed due to: ${failureReason}\n\nPlease update your payout details or contact support: support@dibble.farm`,
    payout_delayed: `Hi ${name},\n\nWe noticed your payout of £${(amountCents! / 100).toFixed(2)} is taking longer than usual. We're investigating and will have an update soon.\n\nContact support if needed: support@dibble.farm`,
  };

  console.log(`[EMAIL] To: ${email}\n${emailTemplates[type]}`);
  // TODO: Integrate with actual email service
}
