import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateMarketplaceSplit, getSiteConfig } from "@/lib/site-config";
import { listSellerPayouts } from "@/lib/seller-payout-ledger";
import { SellerOrderActions } from "@/app/seller/orders/seller-order-actions";

export default async function SellerOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/seller/orders");
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const orders = await prisma.order.findMany({
    where: {
      sellerId: session.user.id,
    },
    include: {
      buyer: {
        select: {
          displayName: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            select: { title: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const config = await getSiteConfig();
  const payoutEntries = (await listSellerPayouts()).filter((entry) => entry.sellerId === session.user.id);
  const payoutByOrderId = new Map(payoutEntries.map((entry) => [entry.orderId, entry]));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Seller Orders</h1>
        <Link href="/seller" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
          Back to Seller Dashboard
        </Link>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? <p className="text-slate-400">No orders yet.</p> : null}
        {orders.map((order) => (
          <article key={order.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold">Order {order.id.slice(0, 8)}</h2>
            <p className="text-sm text-slate-300">Buyer: {order.buyer.displayName ?? order.buyer.email}</p>
            <p className="text-sm text-slate-300">Status: {order.status}</p>
            <p className="text-sm text-slate-300">Total: £{(order.totalCents / 100).toFixed(2)}</p>
            <p className="text-sm text-slate-300">
              Estimated payout: £
              {(calculateMarketplaceSplit(order.totalCents, config.platformFeePercent).sellerPayoutCents / 100).toFixed(2)}
            </p>
            {(() => {
              const payout = payoutByOrderId.get(order.id);
              if (!payout) {
                return <p className="text-sm text-slate-400">Payout status: not available yet</p>;
              }

              const label =
                payout.status === "PAID_OUT"
                  ? "Paid out"
                  : payout.status === "SPLIT_AT_CHARGE"
                    ? "Split at charge"
                    : "Awaiting manual payout";

              return <p className="text-sm text-slate-300">Payout status: {label}</p>;
            })()}
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-400">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.product.title} x {item.quantity}
                </li>
              ))}
            </ul>
            <SellerOrderActions orderId={order.id} />
          </article>
        ))}
      </div>
    </main>
  );
}
