/**
 * Finance reporting and export utilities
 */

import { prisma } from "@/lib/prisma";

interface FinanceReport {
  period: string;
  gmvCents: number;
  platformFeeCents: number;
  sellerEarningsCents: number;
  payoutsCents: number;
  pendingPayoutsCents: number;
  orderCount: number;
  sellerCount: number;
  averageOrderValueCents: number;
}

interface SellerSettlementReport {
  sellerId: string;
  sellerName: string;
  periodStart: Date;
  periodEnd: Date;
  orderCount: number;
  gmvCents: number;
  platformFeeCents: number;
  netEarningsCents: number;
  paidOutCents: number;
  pendingCents: number;
  orders: Array<{
    orderId: string;
    buyerEmail: string;
    totalCents: number;
    feesCents: number;
    netCents: number;
    payoutStatus: string;
    createdAt: Date;
  }>;
}

export async function getFinanceReport(
  startDate: Date,
  endDate: Date
): Promise<FinanceReport> {
  // Get all orders in period
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] },
    },
    include: { payment: true },
  });

  const gmvCents = orders.reduce((sum, order) => sum + (order.payment?.amountCents || 0), 0);
  const platformFeeCents = Math.round(gmvCents * 0.15); // 15% platform fee
  const sellerEarningsCents = gmvCents - platformFeeCents;

  // Get payouts in period
  const payouts = await prisma.sellerPayout.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: "SUCCEEDED",
    },
  });

  const payoutsCents = payouts.reduce((sum, payout) => sum + payout.netAmountCents, 0);

  const pendingPayouts = await prisma.sellerPayout.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: "PLATFORM_PENDING",
    },
  });

  const pendingPayoutsCents = pendingPayouts.reduce(
    (sum, payout) => sum + payout.netAmountCents,
    0
  );

  const sellerCount = await prisma.user.count({
    where: { role: "SELLER", status: "ACTIVE" },
  });

  return {
    period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    gmvCents,
    platformFeeCents,
    sellerEarningsCents,
    payoutsCents,
    pendingPayoutsCents,
    orderCount: orders.length,
    sellerCount,
    averageOrderValueCents: orders.length > 0 ? Math.round(gmvCents / orders.length) : 0,
  };
}

export async function getSellerSettlementReport(
  sellerId: string,
  startDate: Date,
  endDate: Date
): Promise<SellerSettlementReport | null> {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: {
      displayName: true,
      sellerApplication: { select: { shopName: true } },
    },
  });

  if (!seller) return null;

  const orders = await prisma.order.findMany({
    where: {
      sellerId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] },
    },
    include: {
      payment: true,
      buyer: { select: { email: true } },
    },
  });

  const gmvCents = orders.reduce((sum, order) => sum + (order.payment?.amountCents || 0), 0);
  const platformFeeCents = Math.round(gmvCents * 0.15);
  const netEarningsCents = gmvCents - platformFeeCents;

  const payouts = await prisma.sellerPayout.findMany({
    where: {
      sellerId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: "SUCCEEDED",
    },
  });

  const paidOutCents = payouts.reduce((sum, payout) => sum + payout.netAmountCents, 0);
  const pendingCents = netEarningsCents - paidOutCents;

  const sellerName = seller.sellerApplication?.shopName || seller.displayName || "Unknown";

  return {
    sellerId,
    sellerName,
    periodStart: startDate,
    periodEnd: endDate,
    orderCount: orders.length,
    gmvCents,
    platformFeeCents,
    netEarningsCents,
    paidOutCents,
    pendingCents,
    orders: orders.map((order) => ({
      orderId: order.id,
      buyerEmail: order.buyer.email,
      totalCents: order.payment?.amountCents || 0,
      feesCents: Math.round((order.payment?.amountCents || 0) * 0.15),
      netCents: Math.round((order.payment?.amountCents || 0) * 0.85),
      payoutStatus: "TBD", // Will be connected to payout status
      createdAt: order.createdAt,
    })),
  };
}

export function generateCSVFromSettlementReport(report: SellerSettlementReport): string {
  const header = [
    "Order ID",
    "Buyer Email",
    "Gross Amount (£)",
    "Platform Fee (£)",
    "Net Amount (£)",
    "Date",
  ].join(",");

  const rows = report.orders
    .map(
      (order) =>
        [
          order.orderId,
          order.buyerEmail,
          (order.totalCents / 100).toFixed(2),
          (order.feesCents / 100).toFixed(2),
          (order.netCents / 100).toFixed(2),
          order.createdAt.toLocaleDateString("en-GB"),
        ].join(",")
    )
    .join("\n");

  const summary = [
    `\n\nSummary for period: ${report.periodStart.toLocaleDateString()} to ${report.periodEnd.toLocaleDateString()}`,
    `Total Gross Amount (£): ${(report.gmvCents / 100).toFixed(2)}`,
    `Total Platform Fees (£): ${(report.platformFeeCents / 100).toFixed(2)}`,
    `Total Net Earnings (£): ${(report.netEarningsCents / 100).toFixed(2)}`,
    `Already Paid Out (£): ${(report.paidOutCents / 100).toFixed(2)}`,
    `Pending Payout (£): ${(report.pendingCents / 100).toFixed(2)}`,
  ].join("\n");

  return [header, rows, summary].join("\n");
}

export async function exportMonthlyReports(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Get all active sellers
  const sellers = await prisma.user.findMany({
    where: { role: "SELLER", status: "ACTIVE" },
    select: { id: true },
  });

  const reports: Record<string, string> = {};

  for (const seller of sellers) {
    const report = await getSellerSettlementReport(seller.id, startDate, endDate);
    if (report && report.orderCount > 0) {
      reports[`${seller.id}_${year}-${month}.csv`] = generateCSVFromSettlementReport(report);
    }
  }

  return {
    generated: new Date(),
    period: `${year}-${month.toString().padStart(2, "0")}`,
    reports,
  };
}
