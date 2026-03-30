import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const now = new Date();
    const payouts = await prisma.sellerPayout.findMany({
      where: {
        status: "PLATFORM_PENDING",
      },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            email: true,
            sellerApplication: { select: { shopName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    // Calculate days since pending
    const enriched = payouts.map((payout) => ({
      id: payout.id,
      orderId: payout.orderId,
      sellerId: payout.seller.id,
      sellerName:
        payout.seller.sellerApplication?.shopName || payout.seller.displayName || payout.seller.email,
      amountCents: payout.netAmountCents,
      status: payout.status,
      failureReason: payout.failureReason,
      createdAt: payout.createdAt.toISOString(),
      daysSincePending: Math.floor((now.getTime() - payout.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    }));

    return Response.json(enriched);
  } catch (error) {
    console.error("Failed to fetch pending payouts:", error);
    return Response.json({ error: "Failed to fetch payouts" }, { status: 500 });
  }
}
