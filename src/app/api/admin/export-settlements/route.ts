import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { getSellerSettlementReport, generateCSVFromSettlementReport } from "@/lib/finance-reports";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { year, month } = await req.json();

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get all active sellers
    const sellers = await prisma.user.findMany({
      where: { role: Role.SELLER, status: "ACTIVE" },
      select: { id: true },
    });

    const csvContent: Record<string, string> = {};
    const summaries = [];

    for (const seller of sellers) {
      const report = await getSellerSettlementReport(seller.id, startDate, endDate);
      if (report && report.orderCount > 0) {
        const csv = generateCSVFromSettlementReport(report);
        csvContent[`${seller.id}_settlement.csv`] = csv;
        summaries.push({
          sellerId: seller.id,
          sellerName: report.sellerName,
          orderCount: report.orderCount,
          gmvCents: report.gmvCents,
          netEarningsCents: report.netEarningsCents,
          paidOutCents: report.paidOutCents,
          pendingCents: report.pendingCents,
        });
      }
    }

    // Return as ZIP or individual files
    // For now, return JSON with CSV content
    return Response.json({
      generated: new Date(),
      period: `${year}-${month.toString().padStart(2, "0")}`,
      sellerCount: summaries.length,
      summaries,
      files: csvContent,
    });
  } catch (error) {
    console.error("Export settlements failed:", error);
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}
