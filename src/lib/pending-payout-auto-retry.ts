import { logApiEvent } from "@/lib/observability";
import { tryAutoTransferSellerPayout } from "@/lib/seller-payout-automation";
import { listSellerPayouts } from "@/lib/seller-payout-ledger";

export type PendingPayoutAutoRetryResult = {
  scanned: number;
  attempted: number;
  transferred: number;
  skippedNoConnect: number;
  failed: number;
};

export async function runPendingPayoutAutoRetry(limit = 25): Promise<PendingPayoutAutoRetryResult> {
  const all = await listSellerPayouts();
  const pending = all.filter((entry) => entry.status === "PLATFORM_PENDING" && !entry.stripeTransferId);
  const candidates = pending.slice(0, Math.max(0, limit));

  let attempted = 0;
  let transferred = 0;
  let skippedNoConnect = 0;
  let failed = 0;

  for (const payout of candidates) {
    attempted += 1;

    const result = await tryAutoTransferSellerPayout({
      orderId: payout.orderId,
      sellerId: payout.sellerId,
      sellerPayoutCents: payout.sellerPayoutCents,
    });

    if (result.ok) {
      transferred += 1;
      continue;
    }

    if (result.reason === "seller_connect_missing") {
      skippedNoConnect += 1;
    } else {
      failed += 1;
    }
  }

  const summary: PendingPayoutAutoRetryResult = {
    scanned: pending.length,
    attempted,
    transferred,
    skippedNoConnect,
    failed,
  };

  logApiEvent("info", "payout.auto_retry.summary", summary);

  return summary;
}
