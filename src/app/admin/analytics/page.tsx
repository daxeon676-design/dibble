import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config";

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/analytics");
  }

  const config = await getSiteConfig();

  const [totalSellers, totalBuyers, totalOrders, paidRevenue, paidOrdersCount] = await Promise.all([
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.user.count({ where: { role: "BUYER" } }),
    prisma.order.count(),
    prisma.order.aggregate({ where: { payment: { status: "SUCCEEDED" } }, _sum: { totalCents: true } }),
    prisma.order.count({ where: { payment: { status: "SUCCEEDED" } } }),
  ]);

  const grossRevenueCents = paidRevenue._sum.totalCents ?? 0;
  const estimatedPlatformFeesCents = Math.round(grossRevenueCents * (config.platformFeePercent / 100));

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-(--accent-terra)">Admin Analytics</h1>
          <p className="mt-1 text-sm text-foreground/70">Marketplace-level performance and financial overview.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">Admin Dashboard</Link>
          <Link href="/admin/site-settings" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">Site Settings</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Sellers</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">{totalSellers}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Buyers</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">{totalBuyers}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Total Orders</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">{totalOrders}</p>
        </article>
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Paid Orders</p>
          <p className="mt-1 text-2xl font-semibold text-(--accent-terra)">{paidOrdersCount}</p>
        </article>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-5">
          <h2 className="text-lg font-semibold text-(--accent-terra)">Gross Marketplace Revenue</h2>
          <p className="mt-3 text-3xl font-semibold">£{(grossRevenueCents / 100).toFixed(2)}</p>
          <p className="mt-2 text-sm text-foreground/60">Total paid order value before card processing fees.</p>
        </article>

        <article className="rounded-xl border border-(--accent-terra)/25 bg-white p-5">
          <h2 className="text-lg font-semibold text-(--accent-terra)">Estimated Platform Fee Revenue</h2>
          <p className="mt-3 text-3xl font-semibold">£{(estimatedPlatformFeesCents / 100).toFixed(2)}</p>
          <p className="mt-2 text-sm text-foreground/60">
            Calculated at {config.platformFeePercent.toFixed(2)}% of paid order value.
          </p>
        </article>
      </section>
    </main>
  );
}
