import { PaymentStatus } from "@/generated/prisma/enums";
import { cancelSellerPayout, getSellerPayout } from "@/lib/seller-payout-ledger";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function refundDisputeOrderPayment(args: {
  disputeId: string;
  adminId: string;
  note?: string;
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id: args.disputeId },
    include: {
      order: {
        include: {
          payment: true,
          buyer: { select: { id: true, email: true, displayName: true } },
          seller: { select: { id: true, email: true, displayName: true } },
        },
      },
    },
  });

  if (!dispute?.order.payment) {
    throw new Error("This dispute is not linked to a payable order.");
  }

  const payment = dispute.order.payment;

  if (payment.status !== PaymentStatus.SUCCEEDED) {
    throw new Error("Only successful payments can be refunded.");
  }

  if (!payment.stripePaymentIntent) {
    throw new Error("The order payment intent is missing.");
  }

  if (payment.refundedAt || payment.refundAmountCents >= payment.amountCents) {
    throw new Error("This order has already been refunded.");
  }

  const refund = await stripe.refunds.create({
    payment_intent: payment.stripePaymentIntent,
    reason: "requested_by_customer",
    metadata: {
      disputeId: dispute.id,
      orderId: dispute.orderId,
      adminId: args.adminId,
    },
  });

  if (refund.status === "failed" || refund.status === "canceled") {
    throw new Error(refund.failure_reason || "Stripe could not create the refund.");
  }

  const payout = await getSellerPayout(dispute.orderId);
  const payoutRecoveryRequired = payout?.status === "PAID_OUT";

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundAmountCents: payment.amountCents,
        refundedAt: new Date(),
        stripeRefundId: refund.id,
        refundReason: args.note?.trim() || dispute.resolution || dispute.reason,
      },
    });

    const updatedDispute = await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: dispute.status === "CLOSED" ? "CLOSED" : "RESOLVED",
        resolvedById: args.adminId,
        resolvedAt: new Date(),
        ...(args.note?.trim() ? { resolution: args.note.trim() } : {}),
      },
      include: {
        order: {
          include: {
            payment: true,
            buyer: { select: { id: true, email: true, displayName: true } },
            seller: { select: { id: true, email: true, displayName: true } },
          },
        },
        raisedBy: { select: { id: true, email: true, displayName: true } },
        resolvedBy: { select: { id: true, email: true, displayName: true } },
        messages: {
          include: { sender: { select: { id: true, email: true, displayName: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorAdmin: args.adminId,
        action: "DISPUTE_REFUND_ISSUED",
        targetType: "DISPUTE",
        targetId: dispute.id,
        details: JSON.stringify({
          orderId: dispute.orderId,
          refundId: refund.id,
          amountCents: payment.amountCents,
          payoutRecoveryRequired,
        }),
      },
    });

    return { updatedDispute, updatedPayment };
  });

  if (!payoutRecoveryRequired) {
    await cancelSellerPayout(dispute.orderId, "Order refunded through dispute workflow");
  }

  return {
    dispute: updated.updatedDispute,
    payment: updated.updatedPayment,
    refundId: refund.id,
    amountCents: payment.amountCents,
    payoutRecoveryRequired,
  };
}