import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.BUYER) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        buyerId: session.user.id,
      },
      include: {
        payment: true,
        seller: {
          select: {
            displayName: true,
            email: true,
            sellerApplication: { select: { shopName: true } },
          },
        },
        items: {
          include: {
            product: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with timeline data
    const enriched = orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      processingAt: order.status !== "PENDING_PAYMENT" ? order.createdAt : null,
      shippedAt: order.status === "SHIPPED" || order.status === "DELIVERED" ? new Date(order.updatedAt.getTime() + 86400000) : null,
      deliveredAt: order.status === "DELIVERED" ? order.updatedAt : null,
      sellerName:
        order.seller.sellerApplication?.shopName || order.seller.displayName || order.seller.email,
      items: order.items,
    }));

    return Response.json(enriched);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
