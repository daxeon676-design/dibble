import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DisputeStatus, OrderStatus, PaymentStatus, Role, SellerApplicationStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { getLaunchReadiness } from "@/lib/launch-readiness";
import { evaluateOpsAlerts } from "@/lib/ops-alerts";
import { prisma } from "@/lib/prisma";
import { getSystemHealth } from "@/lib/system-health";
import { getSiteConfig } from "@/lib/site-config";
import { ReviewActions } from "@/app/admin/review-actions";
import { DeleteReviewButton } from "@/app/admin/delete-review-button";

function trendArrow(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "↑" : "–";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return `↑${pct}%`;
  if (pct < 0) return `↓${Math.abs(pct)}%`;
  return "–";
}

function trendColor(current: number, previous: number, higherIsBetter = true) {
  if (previous === 0) return "text-slate-400";
  const better = current > previous;
  return better === higherIsBetter ? "text-emerald-400" : "text-red-400";
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleOrderCutoff = new Date(now.getTime() - 15 * 60 * 1000);

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
    // trend: current 7-day window
    gmv7d,
    orders7d,
    newUsers7d,
    // trend: prior 7-day window
    gmvPrev7d,
    ordersPrev7d,
    newUsersPrev7d,
    // ops alert inputs
    paymentFailed24h,
    paymentSucceeded24h,
    webhookFailed24h,
    stalePendingOrders,
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
    // 7d trends
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: d7 } },
    }),
    prisma.order.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: d14, lt: d7 } },
    }),
    prisma.order.count({ where: { createdAt: { gte: d14, lt: d7 } } }),
    prisma.user.count({ where: { createdAt: { gte: d14, lt: d7 } } }),
    // ops alert inputs
    prisma.payment.count({ where: { status: PaymentStatus.FAILED, createdAt: { gte: d24h } } }),
    prisma.payment.count({ where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: d24h } } }),
    prisma.stripeWebhookEvent.count({ where: { status: "FAILED", createdAt: { gte: d24h } } }),
    prisma.order.count({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: { lt: staleOrderCutoff },
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

  // ── Ops alerts ────────────────────────────────────────────────────────────
  const { alerts: opsAlerts } = evaluateOpsAlerts({
    paymentFailed: paymentFailed24h,
    paymentSucceeded: paymentSucceeded24h,
    webhookFailed: webhookFailed24h,
    webhookStaleProcessing: 0,
    stalePendingOrders,
    pendingPayoutCount: 0,
    pendingPayoutTotalCents: 0,
    pendingWithoutConnect: 0,
  });
  // Filter out the synthetic "all-clear" info entry — only surface real issues
  const actionableAlerts = opsAlerts.filter((a) => a.severity !== "info");

  // ── Trend values ──────────────────────────────────────────────────────────
  const gmv7dCents = gmv7d._sum.amountCents ?? 0;
  const gmvPrev7dCents = gmvPrev7d._sum.amountCents ?? 0;

  // ── Active operational flags ───────────────────────────────────────────────
  const activeFlags = [
    siteConfig.maintenanceMode && "Maintenance mode ON",
    siteConfig.checkoutPaused && "Checkout paused",
    siteConfig.newAccountsPaused && "Registrations paused",
  ].filter(Boolean) as string[];

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
          <Link href="/admin/returns" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Returns
          </Link>
          <Link href="/admin/users-support" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Users &amp; Support
          </Link>
          <Link href="/admin/coupons" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Coupons
          </Link>
          <Link href="/admin/security" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Security &amp; Audit
          </Link>
          <Link href="/admin/orders" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Manage All Orders
          </Link>
        </div>
      </div>

      {/* ── Active operational flags banner ───────────────────────────────── */}
      {activeFlags.length > 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-md border border-red-700 bg-red-900/40 px-4 py-3 text-sm font-medium text-red-200">
          <span className="text-red-400">⚠</span>
          Active controls: {activeFlags.join(" · ")}
          <Link href="/admin/site-settings" className="ml-auto text-xs text-red-300 underline">Manage</Link>
        </div>
      ) : null}

      {/* ── Ops alert panel ───────────────────────────────────────────────── */}
      {actionableAlerts.length > 0 ? (
        <section className="mt-4 space-y-2">
          {actionableAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm ${
                alert.severity === "critical"
                  ? "border-red-700 bg-red-900/40 text-red-200"
                  : "border-amber-700 bg-amber-900/30 text-amber-200"
              }`}
            >
              <span>
                <span className="mr-2">{alert.severity === "critical" ? "🔴" : "🟡"}</span>
                {alert.message}
                {" — "}
                <span className="font-semibold">
                  {alert.id === "payment-failure-rate"
                    ? `${(alert.value * 100).toFixed(1)}%`
                    : alert.value}
                </span>
              </span>
              <Link href="/admin/ops" className="shrink-0 text-xs underline opacity-80 hover:opacity-100">
                View in Ops
              </Link>
            </div>
          ))}
        </section>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">GMV (Succeeded Payments)</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            £{((paymentsAgg._sum.amountCents ?? 0) / 100).toFixed(2)}
          </p>
          <p className={`mt-1 text-xs ${trendColor(gmv7dCents, gmvPrev7dCents)}`}>
            7d: £{(gmv7dCents / 100).toFixed(2)} {trendArrow(gmv7dCents, gmvPrev7dCents)} vs prior week
          </p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Users</p>
          <p className="mt-2 text-2xl font-semibold">{totalUsers}</p>
          <p className="mt-1 text-xs text-slate-400">Buyers: {totalBuyers} | Sellers: {totalSellers}</p>
          <p className={`mt-1 text-xs ${trendColor(newUsers7d, newUsersPrev7d)}`}>
            7d new: {newUsers7d} {trendArrow(newUsers7d, newUsersPrev7d)} vs prior week
          </p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Orders</p>
          <p className="mt-2 text-2xl font-semibold">{totalOrders}</p>
          <p className="mt-1 text-xs text-slate-400">Open pipeline: {orderInFlight}</p>
          <p className={`mt-1 text-xs ${trendColor(orders7d, ordersPrev7d)}`}>
            7d: {orders7d} {trendArrow(orders7d, ordersPrev7d)} vs prior week
          </p>
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
              {application.businessType ? (
                <p className="mt-1 text-sm text-slate-400"><span className="text-slate-500">Business type:</span> {application.businessType.replace("_", " ")}</p>
              ) : null}
              {application.businessAddress ? (
                <p className="mt-1 text-sm text-slate-400"><span className="text-slate-500">Address:</span> {application.businessAddress}</p>
              ) : null}
              {application.vatNumber ? (
                <p className="mt-1 text-sm text-slate-400"><span className="text-slate-500">VAT number:</span> {application.vatNumber}</p>
              ) : null}
              {application.planToSell ? (
                <p className="mt-1 text-sm text-slate-400"><span className="text-slate-500">Plans to sell:</span> {application.planToSell}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                Terms accepted: {application.sellerTermsAcceptedAt ? new Date(application.sellerTermsAcceptedAt).toLocaleDateString("en-GB") : "Not recorded"}
                {" · "}18+: {application.confirmedAdult ? "Confirmed" : "Not confirmed"}
              </p>
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
