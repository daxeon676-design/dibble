import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateMarketplaceSplit, getSiteConfig } from "@/lib/site-config";
import { listSellerPayouts } from "@/lib/seller-payout-ledger";
import { SellerOrderActions } from "@/app/seller/orders/seller-order-actions";

export default async function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/seller/orders");
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
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
  });

  if (!order) {
    notFound();
  }

  if (session.user.role !== Role.ADMIN && order.sellerId !== session.user.id) {
    notFound();
  }

  const config = await getSiteConfig();
  const payout = (await listSellerPayouts()).find((entry) => entry.orderId === order.id);
  const split = calculateMarketplaceSplit(order.totalCents, config.platformFeePercent);
  const estimated = split.sellerPayoutCents;

  const payoutLabel = payout
    ? payout.status === "PAID_OUT"
      ? "Paid out"
      : payout.status === "SPLIT_AT_CHARGE"
        ? "Split at charge"
        : payout.status === "CANCELLED"
          ? "Cancelled after refund"
        : "Awaiting manual payout"
    : "Not available yet";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Order {order.id.slice(0, 8)}</h1>
        <Link href="/seller/orders" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
          Back to Seller Orders
        </Link>
      </div>

      <section className="space-y-3 rounded-md border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-300">Buyer: {order.buyer.displayName ?? order.buyer.email}</p>
        <p className="text-sm text-slate-300">Status: {order.status}</p>
        <p className="text-sm text-slate-300">Order total: £{(order.totalCents / 100).toFixed(2)}</p>
        <p className="text-sm text-slate-300">Platform fee ({config.platformFeePercent}%): £{(split.platformFeeCents / 100).toFixed(2)}</p>
        <p className="text-sm text-slate-300">Estimated payout: £{(estimated / 100).toFixed(2)}</p>
        <p className="text-sm text-slate-300">Payout status: {payoutLabel}</p>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-200">Items</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {order.items.map((item) => (
              <li key={item.id}>
                {item.product.title} x {item.quantity}
              </li>
            ))}
          </ul>
        </div>

        <SellerOrderActions orderId={order.id} />
      </section>
    </main>
  );
}
