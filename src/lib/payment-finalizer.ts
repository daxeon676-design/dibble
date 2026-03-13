import { PaymentStatus } from "@/generated/prisma/enums";
import { buildPaymentMutationPlan } from "@/lib/payment-state";
import { prisma } from "@/lib/prisma";

type FinalizeStatus = "SUCCEEDED" | "FAILED";

export async function finalizeOrderPayment(
  orderId: string,
  paymentIntentId: string,
  status: FinalizeStatus,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order?.payment) {
      return { updated: false, reason: "ORDER_OR_PAYMENT_NOT_FOUND" as const };
    }

    const { nextOrderStatus, nextPaymentStatus } = buildPaymentMutationPlan(
      order.payment.status,
      order.status,
      status,
    );

    const paymentPatch: {
      stripePaymentIntent?: string;
      status?: PaymentStatus;
    } = {};

    if (order.payment.stripePaymentIntent !== paymentIntentId) {
      paymentPatch.stripePaymentIntent = paymentIntentId;
    }

    if (nextPaymentStatus !== order.payment.status) {
      paymentPatch.status = nextPaymentStatus;
    }

    if (Object.keys(paymentPatch).length > 0) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: paymentPatch,
      });
    }

    if (nextOrderStatus !== order.status) {
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: nextOrderStatus },
      });

      return { updated: true, order: updatedOrder };
    }

    return { updated: Object.keys(paymentPatch).length > 0, order };
  });
}
