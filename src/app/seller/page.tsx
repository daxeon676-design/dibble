import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OrderStatus, PaymentStatus, ProductStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SellerPayoutsPanel } from "@/app/seller/seller-payouts-panel";

export default async function SellerDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/seller");
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const sellerId = session.user.id;

  const [productCount, activeProductCount, orderCount, deliveredOrderCount, processingOrderCount, revenueAgg, shopProfile, deliveryProfile, sellerUser] =
    await Promise.all([
      prisma.product.count({ where: { sellerId } }),
      prisma.product.count({ where: { sellerId, status: ProductStatus.ACTIVE } }),
      prisma.order.count({ where: { sellerId } }),
      prisma.order.count({ where: { sellerId, status: OrderStatus.DELIVERED } }),
      prisma.order.count({
        where: {
          sellerId,
          status: { in: [OrderStatus.PROCESSING, OrderStatus.SHIPPED] },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: {
          status: PaymentStatus.SUCCEEDED,
          order: {
            sellerId,
          },
        },
      }),
      prisma.shopProfile.findUnique({ where: { sellerId }, select: { logoUrl: true, description: true } }),
      prisma.deliveryProfile.findUnique({ where: { sellerId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: sellerId }, select: { payoutMethod: true, stripeConnectAccountId: true } }),
    ]);

  const setupSteps = [
    { label: "Add a shop logo", done: Boolean(shopProfile?.logoUrl), href: "/seller/settings" },
    { label: "Write your shop description", done: Boolean(shopProfile?.description), href: "/seller/settings" },
    { label: "Set up a delivery option", done: Boolean(deliveryProfile?.id), href: "/seller/delivery-options" },
    { label: "List your first product", done: productCount > 0, href: "/seller/products/new" },
    { label: "Complete payout setup", done: Boolean(sellerUser?.payoutMethod || sellerUser?.stripeConnectAccountId), href: "/seller/payouts-help" },
  ];
  const allSetupDone = setupSteps.every((s) => s.done);

  const recentOrders = await prisma.order.findMany({
    where: { sellerId },
    include: {
      buyer: {
        select: {
          displayName: true,
          email: true,
        },
      },
      payment: {
        select: {
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 text-slate-100">
      <h1 className="text-3xl font-semibold">Seller Dashboard</h1>
      <p className="mt-2 text-slate-300">Welcome, {session.user.email}</p>
      <p className="mt-1 text-sm text-slate-400">Manage listings, orders, and monitor store performance.</p>

      {!allSetupDone && (
        <section className="mt-6 rounded-xl border border-emerald-700/50 bg-emerald-950/40 p-5">
          <h2 className="text-base font-semibold text-emerald-300">Getting Started</h2>
          <p className="mt-1 text-sm text-slate-400">Complete these steps to get your shop ready.</p>
          <ul className="mt-4 space-y-2">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-emerald-500 text-slate-950" : "border border-slate-600 text-slate-500"}`}>
                  {step.done ? "✓" : ""}
                </span>
                {step.done ? (
                  <span className="text-slate-400 line-through">{step.label}</span>
                ) : (
                  <Link href={step.href} className="text-emerald-300 underline underline-offset-2">
                    {step.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Gross Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            £{((revenueAgg._sum.amountCents ?? 0) / 100).toFixed(2)}
          </p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Orders</p>
          <p className="mt-2 text-2xl font-semibold">{orderCount}</p>
          <p className="mt-1 text-xs text-slate-400">Delivered: {deliveredOrderCount}</p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Active Fulfillment</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{processingOrderCount}</p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Products</p>
          <p className="mt-2 text-2xl font-semibold">{productCount}</p>
          <p className="mt-1 text-xs text-slate-400">Live listings: {activeProductCount}</p>
        </article>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Recent Orders</h2>
        <div className="mt-3 space-y-2">
          {recentOrders.length === 0 ? <p className="text-sm text-slate-400">No orders yet.</p> : null}
          {recentOrders.map((order) => (
            <article key={order.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  <span className="text-slate-400">Buyer:</span> {order.buyer.displayName ?? order.buyer.email}
                </p>
                <p>
                  <span className="text-slate-400">Order:</span> {order.status}
                </p>
                <p>
                  <span className="text-slate-400">Payment:</span> {order.payment?.status ?? "UNKNOWN"}
                </p>
                <p>
                  <span className="text-slate-400">Total:</span> £{(order.totalCents / 100).toFixed(2)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <SellerPayoutsPanel />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/seller/products" className="rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950">
          Manage Products
        </Link>
        <Link href="/seller/settings" className="rounded-md border border-slate-700 px-4 py-2">
          Shop Settings
        </Link>
        <Link href="/seller/delivery-options" className="rounded-md border border-slate-700 px-4 py-2">
          Delivery Options
        </Link>
        <Link href="/seller/orders" className="rounded-md border border-slate-700 px-4 py-2">
          Manage Orders
        </Link>
        <Link href="/seller/returns" className="rounded-md border border-slate-700 px-4 py-2">
          Return Requests
        </Link>
        <Link href="/seller/coupons" className="rounded-md border border-slate-700 px-4 py-2">
          Coupon Codes
        </Link>
        <Link href="/seller/payouts-help" className="rounded-md border border-slate-700 px-4 py-2">
          Payout Setup Guide
        </Link>
        <Link href="/buyer/marketplace" className="rounded-md border border-slate-700 px-4 py-2">
          View Marketplace
        </Link>
        <Link href="/account/mfa" className="rounded-md border border-slate-700 px-4 py-2">
          Security (2FA)
        </Link>
        <Link href="/account/email-preferences" className="rounded-md border border-slate-700 px-4 py-2">
          Email Preferences
        </Link>
      </div>
    </main>
  );
}
