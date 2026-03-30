import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { tryAutoTransferSellerPayout } from "@/lib/seller-payout-automation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { payoutIds } = await req.json();
  if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
    return Response.json({ error: "Invalid payoutIds" }, { status: 400 });
  }

  try {
    const results = [];

    for (const payoutId of payoutIds.slice(0, 25)) {
      // Safety limit
      const payout = await prisma.sellerPayout.findUnique({
        where: { id: payoutId },
      });

      if (!payout) continue;

      const result = await tryAutoTransferSellerPayout({
        orderId: payout.orderId || payoutId,
        sellerId: payout.sellerId,
        sellerPayoutCents: payout.netAmountCents,
      });

      results.push({
        payoutId,
        success: result.ok,
        reason: result.reason,
        stripeTransferId: result.stripeTransferId,
      });
    }

    return Response.json({
      retriedCount: results.length,
      results,
    });
  } catch (error) {
    console.error("Retry payouts failed:", error);
    return Response.json({ error: "Retry failed" }, { status: 500 });
  }
}
