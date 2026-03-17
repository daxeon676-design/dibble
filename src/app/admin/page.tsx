import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DisputeStatus, OrderStatus, PaymentStatus, Role, SellerApplicationStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { getLaunchReadiness } from "@/lib/launch-readiness";
import { prisma } from "@/lib/prisma";
import { getSystemHealth } from "@/lib/system-health";
import { getSiteConfig } from "@/lib/site-config";
import { ReviewActions } from "@/app/admin/review-actions";
import { DeleteReviewButton } from "@/app/admin/delete-review-button";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const [
    pendingApplications,
    totalUsers,
    totalSellers,
    totalBuyers,
    totalProducts,
    totalOrders,
    orderInFlight,
    openSupportDisputes,
    paymentsAgg,
    topSellerPayments,
    recentReviews,
  ] = await Promise.all([
    prisma.sellerApplication.findMany({
      where: { status: SellerApplicationStatus.PENDING },
      orderBy: { submittedAt: "asc" },
      include: {
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.SELLER } }),
    prisma.user.count({ where: { role: Role.BUYER } }),
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.count({
      where: {
        status: {
          in: [OrderStatus.PENDING_PAYMENT, OrderStatus.PROCESSING, OrderStatus.SHIPPED],
        },
      },
    }),
    prisma.dispute.count({
      where: {
        status: {
          in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
        },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: PaymentStatus.SUCCEEDED },
    }),
    prisma.payment.groupBy({
      by: ["orderId"],
      _sum: { amountCents: true },
      where: { status: PaymentStatus.SUCCEEDED },
      orderBy: {
        _sum: {
          amountCents: "desc",
        },
      },
      take: 40,
    }),
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        product: { select: { id: true, title: true } },
        buyer: { select: { displayName: true, email: true } },
      },
    }),
  ]);

  const topOrderIds = topSellerPayments.map((payment) => payment.orderId);
  const ordersForTopSellers =
    topOrderIds.length === 0
      ? []
      : await prisma.order.findMany({
          where: { id: { in: topOrderIds } },
          select: {
            id: true,
            sellerId: true,
            seller: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        });

  const orderToSeller = new Map(
    ordersForTopSellers.map((order) => [
      order.id,
      {
        sellerId: order.sellerId,
        sellerName: order.seller.displayName ?? order.seller.email,
      },
    ]),
  );

  const sellerRevenueMap = new Map<string, { sellerName: string; amountCents: number }>();
  for (const payment of topSellerPayments) {
    const seller = orderToSeller.get(payment.orderId);
    if (!seller || !payment._sum.amountCents) {
      continue;
    }

    const existing = sellerRevenueMap.get(seller.sellerId);
    sellerRevenueMap.set(seller.sellerId, {
      sellerName: seller.sellerName,
      amountCents: (existing?.amountCents ?? 0) + payment._sum.amountCents,
    });
  }

  const topSellers = [...sellerRevenueMap.values()]
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 5);

  const [systemHealth, launchReadiness, siteConfig] = await Promise.all([
    getSystemHealth(),
    getLaunchReadiness(),
    getSiteConfig(),
  ]);

  const sellerCapacityPercent = siteConfig.maxActiveSellerAccounts > 0
    ? Math.round((totalSellers / siteConfig.maxActiveSellerAccounts) * 100)
    : 0;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 text-slate-100">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/admin/site-settings" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Site Settings
          </Link>
          <Link href="/admin/legal-pages" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Legal Pages
          </Link>
          <Link href="/admin/payouts" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Payout Queue
          </Link>
          <Link href="/admin/payout-profiles" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Payout Profiles
          </Link>
          <Link href="/admin/ops" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Ops Dashboard
          </Link>
          <Link href="/admin/launch-config" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Launch Config
          </Link>
          <Link href="/admin/disputes" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Disputes
          </Link>
          <Link href="/admin/users-support" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Users &amp; Support
          </Link>
          <Link href="/admin/security" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Security &amp; Audit
          </Link>
          <Link href="/admin/orders" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Manage All Orders
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">GMV (Succeeded Payments)</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            £{((paymentsAgg._sum.amountCents ?? 0) / 100).toFixed(2)}
          </p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Users</p>
          <p className="mt-2 text-2xl font-semibold">{totalUsers}</p>
          <p className="mt-1 text-xs text-slate-400">Buyers: {totalBuyers} | Sellers: {totalSellers}</p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Orders</p>
          <p className="mt-2 text-2xl font-semibold">{totalOrders}</p>
          <p className="mt-1 text-xs text-slate-400">Open pipeline: {orderInFlight}</p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Catalog</p>
          <p className="mt-2 text-2xl font-semibold">{totalProducts}</p>
          <p className="mt-1 text-xs text-slate-400">Pending applications: {pendingApplications.length}</p>
        </article>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">System Health</p>
          <p className={`mt-2 text-xl font-semibold ${systemHealth.ok ? "text-emerald-300" : "text-red-300"}`}>
            {systemHealth.ok ? "Healthy" : "Degraded"}
          </p>
          <p className="mt-1 text-xs text-slate-400">Database: {systemHealth.services.database.ok ? "OK" : "Fail"}</p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Launch Gate</p>
          <p className={`mt-2 text-xl font-semibold ${launchReadiness.readyToLaunch ? "text-emerald-300" : "text-amber-300"}`}>
            {launchReadiness.readyToLaunch ? "Ready to Launch" : "Not Ready"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Passing checks: {launchReadiness.checks.filter((check) => check.passed).length}/{launchReadiness.checks.length}
          </p>
          <div className="mt-2">
            <Link href="/admin/ops" className="text-xs text-emerald-300 hover:underline">
              View full readiness details in Ops
            </Link>
          </div>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Seller Capacity</p>
          <p className="mt-2 text-xl font-semibold text-amber-200">
            {totalSellers}/{siteConfig.maxActiveSellerAccounts}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {sellerCapacityPercent}% in use. {siteConfig.allowNewSellerApplications ? "Applications open" : "Applications paused"}.
          </p>
          <div className="mt-2">
            <Link href="/admin/site-settings" className="text-xs text-emerald-300 hover:underline">
              Update seller limit
            </Link>
          </div>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Support Workload</p>
          <p className="mt-2 text-xl font-semibold text-sky-200">
            {openSupportDisputes} open dispute{openSupportDisputes === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Pending seller applications: {pendingApplications.length}
          </p>
          <div className="mt-2">
            <Link href="/admin/disputes" className="text-xs text-emerald-300 hover:underline">
              Review support queues
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-8 rounded-md border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Top Sellers by Revenue</h2>
        <div className="mt-3 space-y-2">
          {topSellers.length === 0 ? <p className="text-sm text-slate-400">No seller revenue yet.</p> : null}
          {topSellers.map((seller, index) => (
            <article key={`${seller.sellerName}-${index}`} className="flex items-center justify-between rounded-md bg-slate-950 p-2 text-sm">
              <p>{index + 1}. {seller.sellerName}</p>
              <p className="font-semibold text-emerald-300">£{(seller.amountCents / 100).toFixed(2)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Pending Seller Applications</h2>
        <div className="mt-3 space-y-4">
          {pendingApplications.length === 0 ? <p className="text-sm text-slate-400">No pending applications.</p> : null}
          {pendingApplications.map((application) => (
            <article key={application.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-lg font-semibold">{application.shopName}</h2>
              <p className="mt-1 text-sm text-slate-300">Applicant: {application.user.displayName ?? application.user.email}</p>
              <p className="mt-2 text-sm text-slate-400">{application.description}</p>
              <ReviewActions applicationId={application.id} />
              <p className="mt-2 text-xs text-slate-500">Application ID: {application.id}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-md border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Recent Product Reviews</h2>
        <div className="mt-3 space-y-3">
          {recentReviews.length === 0 ? <p className="text-sm text-slate-400">No reviews yet.</p> : null}
          {recentReviews.map((review) => (
            <article key={review.id} className="rounded-md bg-slate-950 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{review.product.title}</p>
                  <p className="text-xs text-slate-400">{review.buyer.displayName ?? review.buyer.email} · {review.rating}/5</p>
                </div>
                <DeleteReviewButton reviewId={review.id} />
              </div>
              <p className="mt-2 text-slate-300">{review.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
