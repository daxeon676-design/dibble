import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminDisputesClient from "./admin-disputes-client";

export const metadata = { title: "Disputes – Admin" };

export default async function AdminDisputesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  const disputes = await prisma.dispute.findMany({
    include: {
      order: {
        select: {
          id: true,
          totalCents: true,
          createdAt: true,
          sellerId: true,
          buyer: { select: { id: true, email: true, displayName: true } },
          seller: { select: { id: true, email: true, displayName: true } },
          payment: {
            select: {
              id: true,
              status: true,
              amountCents: true,
              refundAmountCents: true,
              refundedAt: true,
              stripeRefundId: true,
              refundReason: true,
            },
          },
        },
      },
      raisedBy: { select: { id: true, email: true, displayName: true } },
      resolvedBy: { select: { id: true, email: true, displayName: true } },
      messages: {
        include: {
          sender: { select: { id: true, email: true, displayName: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return <AdminDisputesClient disputes={disputes} />;
}
