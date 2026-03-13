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
      order: { select: { id: true, totalCents: true, createdAt: true } },
      raisedBy: { select: { id: true, email: true, displayName: true } },
      resolvedBy: { select: { id: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return <AdminDisputesClient disputes={disputes} />;
}
