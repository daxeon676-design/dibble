import { PaymentStatus } from "@/generated/prisma/enums";
import { buildPaymentMutationPlan } from "@/lib/payment-state";
import { calculateMarketplaceSplit, getSellerStripeAccountId, getSiteConfig } from "@/lib/site-config";
import { upsertSellerPayout } from "@/lib/seller-payout-ledger";
import { prisma } from "@/lib/prisma";

type FinalizeStatus = "SUCCEEDED" | "FAILED";

export async function finalizeOrderPayment(
  orderId: string,
  paymentIntentId: string,
  status: FinalizeStatus,
) {
  const config = status === "SUCCEEDED" ? await getSiteConfig() : null;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        items: {
          select: {
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order?.payment) {
      return { updated: false, reason: "ORDER_OR_PAYMENT_NOT_FOUND" as const };
    }

    const { nextOrderStatus, nextPaymentStatus } = buildPaymentMutationPlan(
      order.payment.status,
      order.status,
      status,
    );

    const shouldRestockReservedItems =
      status === "FAILED" &&
      order.payment.status === PaymentStatus.PENDING &&
      nextPaymentStatus === PaymentStatus.FAILED;

    if (shouldRestockReservedItems) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }
    }

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

      if (status === "SUCCEEDED") {
        const split = calculateMarketplaceSplit(order.totalCents, config?.platformFeePercent ?? 0);
        const hasConnectedAccount = Boolean(await getSellerStripeAccountId(order.sellerId));

        await upsertSellerPayout({
          orderId: order.id,
          sellerId: order.sellerId,
          grossCents: order.totalCents,
          platformFeeCents: split.platformFeeCents,
          sellerPayoutCents: split.sellerPayoutCents,
          status: hasConnectedAccount ? "SPLIT_AT_CHARGE" : "PLATFORM_PENDING",
        });
      }

      return { updated: true, order: updatedOrder };
    }

    if (status === "SUCCEEDED") {
      const split = calculateMarketplaceSplit(order.totalCents, config?.platformFeePercent ?? 0);
      const hasConnectedAccount = Boolean(await getSellerStripeAccountId(order.sellerId));

      await upsertSellerPayout({
        orderId: order.id,
        sellerId: order.sellerId,
        grossCents: order.totalCents,
        platformFeeCents: split.platformFeeCents,
        sellerPayoutCents: split.sellerPayoutCents,
        status: hasConnectedAccount ? "SPLIT_AT_CHARGE" : "PLATFORM_PENDING",
      });
    }

    return { updated: Object.keys(paymentPatch).length > 0, order };
  });
}
