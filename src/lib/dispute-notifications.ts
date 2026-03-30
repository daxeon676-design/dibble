import { NotificationType } from "@/generated/prisma/enums";
import { sendPreferenceAwareEmail } from "@/lib/preference-email";
import { prisma } from "@/lib/prisma";

type Recipient = {
  id: string;
  email: string;
  displayName?: string | null;
};

type NotificationPayload = {
  recipient: Recipient;
  title: string;
  body: string;
  href: string;
  emailSubject: string;
  emailHtml: string;
};

function recipientName(recipient: Recipient) {
  return recipient.displayName?.trim() || recipient.email;
}

async function dispatchNotification(payload: NotificationPayload) {
  const operations: Array<Promise<unknown>> = [
    prisma.notification.create({
      data: {
        userId: payload.recipient.id,
        type: NotificationType.SYSTEM,
        title: payload.title,
        body: payload.body,
        href: payload.href,
      },
    }),
  ];

  if (payload.recipient.id) {
    operations.push(
      sendPreferenceAwareEmail({
        userId: payload.recipient.id,
        preferenceKey: "disputeUpdates",
        to: payload.recipient.email,
        subject: payload.emailSubject,
        html: payload.emailHtml,
      }),
    );
  }

  await Promise.allSettled(operations);
}

export async function notifyDisputeReply(args: {
  disputeId: string;
  orderId: string;
  reason: string;
  buyer: Recipient;
  seller: Recipient;
  adminName: string;
}) {
  const orderLabel = args.orderId.slice(0, 8).toUpperCase();
  await Promise.allSettled([
    dispatchNotification({
      recipient: args.buyer,
      title: "Dispute updated",
      body: `A new admin reply was added to your dispute for order #${orderLabel}.`,
      href: "/buyer/disputes",
      emailSubject: `Update on your Dibble dispute for order #${orderLabel}`,
      emailHtml: `<p>Hi ${recipientName(args.buyer)},</p><p>${args.adminName} added an update to your dispute for order <strong>#${orderLabel}</strong>.</p><p>Reason: ${args.reason}</p><p>Please sign in to review the latest response.</p>`,
    }),
    dispatchNotification({
      recipient: args.seller,
      title: "Dispute updated",
      body: `A new admin reply was added to the dispute for order #${orderLabel}.`,
      href: `/seller/orders/${args.orderId}`,
      emailSubject: `Update on a Dibble dispute for order #${orderLabel}`,
      emailHtml: `<p>Hi ${recipientName(args.seller)},</p><p>${args.adminName} added an update to the dispute for order <strong>#${orderLabel}</strong>.</p><p>Reason: ${args.reason}</p><p>Please sign in to review the latest update for this order.</p>`,
    }),
  ]);
}

export async function notifyDisputeResolution(args: {
  orderId: string;
  reason: string;
  resolution: string;
  buyer: Recipient;
  seller: Recipient;
}) {
  const orderLabel = args.orderId.slice(0, 8).toUpperCase();
  await Promise.allSettled([
    dispatchNotification({
      recipient: args.buyer,
      title: "Dispute resolved",
      body: `Your dispute for order #${orderLabel} has been updated.`,
      href: "/buyer/disputes",
      emailSubject: `Your Dibble dispute for order #${orderLabel} has been updated`,
      emailHtml: `<p>Hi ${recipientName(args.buyer)},</p><p>Your dispute for order <strong>#${orderLabel}</strong> has been updated.</p><p>Reason: ${args.reason}</p><p>Outcome: ${args.resolution}</p>`,
    }),
    dispatchNotification({
      recipient: args.seller,
      title: "Dispute outcome recorded",
      body: `A dispute outcome has been recorded for order #${orderLabel}.`,
      href: `/seller/orders/${args.orderId}`,
      emailSubject: `A Dibble dispute outcome was recorded for order #${orderLabel}`,
      emailHtml: `<p>Hi ${recipientName(args.seller)},</p><p>A dispute outcome has been recorded for order <strong>#${orderLabel}</strong>.</p><p>Reason: ${args.reason}</p><p>Outcome: ${args.resolution}</p>`,
    }),
  ]);
}

export async function notifyDisputeRefund(args: {
  orderId: string;
  amountCents: number;
  buyer: Recipient;
  seller: Recipient;
}) {
  const orderLabel = args.orderId.slice(0, 8).toUpperCase();
  const amount = `£${(args.amountCents / 100).toFixed(2)}`;

  await Promise.allSettled([
    dispatchNotification({
      recipient: args.buyer,
      title: "Refund issued",
      body: `A refund of ${amount} has been issued for order #${orderLabel}.`,
      href: "/buyer/disputes",
      emailSubject: `Refund issued for your Dibble order #${orderLabel}`,
      emailHtml: `<p>Hi ${recipientName(args.buyer)},</p><p>A refund of <strong>${amount}</strong> has been issued for order <strong>#${orderLabel}</strong>.</p><p>Please allow a few business days for your bank to reflect the refund.</p>`,
    }),
    dispatchNotification({
      recipient: args.seller,
      title: "Refund issued on order",
      body: `A refund of ${amount} has been issued for order #${orderLabel}.`,
      href: `/seller/orders/${args.orderId}`,
      emailSubject: `Refund issued for Dibble order #${orderLabel}`,
      emailHtml: `<p>Hi ${recipientName(args.seller)},</p><p>A refund of <strong>${amount}</strong> has been issued for order <strong>#${orderLabel}</strong>.</p>`,
    }),
  ]);
}