import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SellerAnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/seller/analytics");
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const sellerId = session.user.id;

  const [followers, activeProducts, totalProducts, paidOrders, revenueAgg, topProducts] = await Promise.all([
    prisma.sellerFollow.count({ where: { sellerId } }),
    prisma.product.count({ where: { sellerId, status: "ACTIVE" } }),
    prisma.product.count({ where: { sellerId } }),
    prisma.order.count({ where: { sellerId, payment: { status: "SUCCEEDED" } } }),
    prisma.order.aggregate({
      where: { sellerId, payment: { status: "SUCCEEDED" } },
      _sum: { totalCents: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          sellerId,
          payment: { status: "SUCCEEDED" },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const productLookup = topProducts.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: topProducts.map((entry) => entry.productId) } },
        select: { id: true, title: true },
      })
    : [];

  const productNameById = new Map(productLookup.map((p) => [p.id, p.title]));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-(--accent-terra)">Seller Analytics</h1>
          <p className="mt-1 text-sm text-foreground/70">Track your shop performance and product rankings.</p>
        </div>
        <Link href="/seller" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
          Back to Seller Dashboard
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Followers</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">{followers}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Active Listings</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">{activeProducts}</p>
          <p className="text-xs text-foreground/60">of {totalProducts} total</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Revenue (All Time)</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">£{((revenueAgg._sum.totalCents ?? 0) / 100).toFixed(2)}</p>
          <p className="text-xs text-foreground/60">from {paidOrders} paid orders</p>
        </article>
      </section>

      <section className="mt-8 rounded-xl border border-(--accent-terra)/25 bg-white p-5">
        <h2 className="text-lg font-semibold text-(--accent-terra)">Top Products</h2>
        <div className="mt-3 space-y-2">
          {topProducts.length === 0 ? <p className="text-sm text-foreground/60">No sales yet.</p> : null}
          {topProducts.map((entry, index) => (
            <div key={entry.productId} className="flex items-center justify-between rounded-md border border-(--accent-terra)/20 px-3 py-2">
              <p className="text-sm">#{index + 1} {productNameById.get(entry.productId) ?? entry.productId}</p>
              <p className="text-sm font-medium">{entry._sum.quantity ?? 0} sold</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
