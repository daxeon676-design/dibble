import { getServerSession } from "next-auth";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrderStatus, PaymentStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasOpenReturnForOrder, listReturnRequests } from "@/lib/returns";
import BuyerReturnsClient from "@/app/buyer/returns/buyer-returns-client";

export const metadata: Metadata = { title: "Returns - Buyer" };

export default async function BuyerReturnsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/buyer/returns");
  }

  if (session.user.role !== Role.BUYER && session.user.role !== Role.ADMIN) {
    redirect("/seller");
  }

  const [rows, orders] = await Promise.all([
    listReturnRequests(),
    prisma.order.findMany({
      where: {
        buyerId: session.user.id,
        status: OrderStatus.DELIVERED,
        payment: { is: { status: PaymentStatus.SUCCEEDED } },
      },
      select: {
        id: true,
        totalCents: true,
        createdAt: true,
        seller: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const myReturns = rows.filter((row) => row.buyerId === session.user.id);
  const eligibleOrders = orders.filter((order) => !hasOpenReturnForOrder(rows, order.id));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-slate-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Returns</h1>
          <p className="mt-1 text-sm text-slate-400">Request a return for delivered orders and track the RMA progress.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/buyer/orders" className="rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
            Back to Orders
          </Link>
          <Link href="/buyer" className="rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
            Dashboard
          </Link>
        </div>
      </div>

      <BuyerReturnsClient
        initialReturns={myReturns}
        eligibleOrders={eligibleOrders.map((order) => ({
          id: order.id,
          totalCents: order.totalCents,
          createdAt: order.createdAt.toISOString(),
          sellerName: order.seller.displayName ?? order.seller.email,
        }))}
      />
    </main>
  );
}
