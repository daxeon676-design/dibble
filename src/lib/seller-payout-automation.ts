import { logApiEvent } from "@/lib/observability";
import { getSellerStripeAccountId } from "@/lib/site-config";
import {
  getSellerPayout,
  markSellerPayoutPaidWithTransfer,
} from "@/lib/seller-payout-ledger";
import { stripe } from "@/lib/stripe";

type AutoPayoutInput = {
  orderId: string;
  sellerId: string;
  sellerPayoutCents: number;
  chargeId?: string;
};

export async function tryAutoTransferSellerPayout(input: AutoPayoutInput): Promise<{
  ok: boolean;
  reason?: string;
  stripeTransferId?: string;
}> {
  if (!stripe) {
    return { ok: false, reason: "stripe_not_configured" };
  }

  const sellerStripeAccountId = await getSellerStripeAccountId(input.sellerId);
  if (!sellerStripeAccountId) {
    return { ok: false, reason: "seller_connect_missing" };
  }

  const existing = await getSellerPayout(input.orderId);
  if (existing?.status === "PAID_OUT" && existing.stripeTransferId) {
    return { ok: true, reason: "already_paid", stripeTransferId: existing.stripeTransferId };
  }

  if (existing && existing.status !== "PLATFORM_PENDING") {
    return { ok: false, reason: `payout_${existing.status.toLowerCase()}` };
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: input.sellerPayoutCents,
      currency: "gbp",
      destination: sellerStripeAccountId,
      transfer_group: `order_${input.orderId}`,
      ...(input.chargeId ? { source_transaction: input.chargeId } : {}),
      metadata: {
        orderId: input.orderId,
        sellerId: input.sellerId,
      },
    });

    await markSellerPayoutPaidWithTransfer(input.orderId, transfer.id);

    logApiEvent("info", "payout.auto_transfer.success", {
      orderId: input.orderId,
      sellerId: input.sellerId,
      transferId: transfer.id,
      amount: input.sellerPayoutCents,
    });

    return { ok: true, stripeTransferId: transfer.id };
  } catch (error) {
    logApiEvent("warn", "payout.auto_transfer.failed", {
      orderId: input.orderId,
      sellerId: input.sellerId,
      amount: input.sellerPayoutCents,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return { ok: false, reason: "transfer_failed" };
  }
}
