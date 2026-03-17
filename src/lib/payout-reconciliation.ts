import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { listSellerPayouts } from "@/lib/seller-payout-ledger";

export type ReconciliationIssueType =
  | "MISSING_TRANSFER_ID"
  | "TRANSFER_NOT_FOUND"
  | "TRANSFER_AMOUNT_MISMATCH"
  | "TRANSFER_NOT_EXPECTED_FOR_PENDING"
  | "PAID_OUT_BUT_PAYMENT_NOT_SUCCEEDED"
  | "PENDING_BUT_PAYMENT_SUCCEEDED";

export type ReconciliationIssue = {
  orderId: string;
  sellerId: string;
  type: ReconciliationIssueType;
  details: string;
};

export type ReconciliationSummary = {
  scanned: number;
  paidOutCount: number;
  pendingCount: number;
  issuesCount: number;
  stripeChecksPerformed: number;
  stripeEnabled: boolean;
};

export async function reconcileSellerPayouts() {
  const ledger = await listSellerPayouts();
  const issues: ReconciliationIssue[] = [];

  const orderIds = ledger.map((entry) => entry.orderId);
  const payments =
    orderIds.length > 0
      ? await prisma.payment.findMany({
          where: { orderId: { in: orderIds } },
          select: { orderId: true, status: true },
        })
      : [];

  const paymentByOrderId = new Map(payments.map((payment) => [payment.orderId, payment.status]));

  let stripeChecksPerformed = 0;

  for (const entry of ledger) {
    const paymentStatus = paymentByOrderId.get(entry.orderId);

    if (entry.status === "PAID_OUT" && paymentStatus !== "SUCCEEDED") {
      issues.push({
        orderId: entry.orderId,
        sellerId: entry.sellerId,
        type: "PAID_OUT_BUT_PAYMENT_NOT_SUCCEEDED",
        details: `Payment status is ${paymentStatus ?? "missing"}`,
      });
    }

    if (entry.status === "PLATFORM_PENDING" && paymentStatus === "SUCCEEDED") {
      issues.push({
        orderId: entry.orderId,
        sellerId: entry.sellerId,
        type: "PENDING_BUT_PAYMENT_SUCCEEDED",
        details: "Payment succeeded but payout still pending",
      });
    }

    if (entry.status === "PAID_OUT" && !entry.stripeTransferId) {
      if (entry.payoutReference?.startsWith("tr_")) {
        continue;
      }

      issues.push({
        orderId: entry.orderId,
        sellerId: entry.sellerId,
        type: "MISSING_TRANSFER_ID",
        details: "Paid out entry has no stripe transfer id",
      });
      continue;
    }

    if (entry.status === "PLATFORM_PENDING" && entry.stripeTransferId) {
      issues.push({
        orderId: entry.orderId,
        sellerId: entry.sellerId,
        type: "TRANSFER_NOT_EXPECTED_FOR_PENDING",
        details: `Pending entry has transfer id ${entry.stripeTransferId}`,
      });
      continue;
    }

    if (!stripe || !entry.stripeTransferId) {
      continue;
    }

    stripeChecksPerformed += 1;

    try {
      const transfer = await stripe.transfers.retrieve(entry.stripeTransferId);
      if (transfer.amount !== entry.sellerPayoutCents) {
        issues.push({
          orderId: entry.orderId,
          sellerId: entry.sellerId,
          type: "TRANSFER_AMOUNT_MISMATCH",
          details: `Ledger=${entry.sellerPayoutCents}, Stripe=${transfer.amount}`,
        });
      }
    } catch {
      issues.push({
        orderId: entry.orderId,
        sellerId: entry.sellerId,
        type: "TRANSFER_NOT_FOUND",
        details: `Transfer ${entry.stripeTransferId} could not be retrieved from Stripe`,
      });
    }
  }

  const summary: ReconciliationSummary = {
    scanned: ledger.length,
    paidOutCount: ledger.filter((entry) => entry.status === "PAID_OUT").length,
    pendingCount: ledger.filter((entry) => entry.status === "PLATFORM_PENDING").length,
    issuesCount: issues.length,
    stripeChecksPerformed,
    stripeEnabled: Boolean(stripe),
  };

  return {
    summary,
    issues,
    generatedAt: new Date().toISOString(),
  };
}
