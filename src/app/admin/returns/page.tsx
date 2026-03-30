import { getServerSession } from "next-auth";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listReturnRequests } from "@/lib/returns";
import ReturnsQueueClient from "@/app/returns/returns-queue-client";

export const metadata: Metadata = { title: "Returns - Admin" };

export default async function AdminReturnsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/returns");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const rows = await listReturnRequests();
  const orderIds = [...new Set(rows.map((row) => row.orderId))];

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      totalCents: true,
      buyer: { select: { displayName: true, email: true } },
      seller: { select: { displayName: true, email: true } },
    },
  });

  const orderMap = new Map(
    orders.map((order) => [
      order.id,
      {
        totalCents: order.totalCents,
        buyerName: order.buyer.displayName ?? order.buyer.email,
        sellerName: order.seller.displayName ?? order.seller.email,
      },
    ]),
  );

  const enrichedRows = rows.map((row) => ({
    ...row,
    orderSummary: orderMap.get(row.orderId) ?? null,
  }));

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-slate-100">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold">Returns Moderation</h1>
        <div className="flex gap-2">
          <Link href="/admin/users-support" className="rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
            Users & Support
          </Link>
          <Link href="/admin" className="rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
            Admin Dashboard
          </Link>
        </div>
      </div>
      <ReturnsQueueClient title="All Return Requests" initialRows={enrichedRows} />
    </main>
  );
}
