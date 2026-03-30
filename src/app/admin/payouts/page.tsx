import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSellerPayout,
  listSellerPayouts,
  markSellerPayoutPaid,
  markSellerPayoutPaidWithTransfer,
} from "@/lib/seller-payout-ledger";
import {
  getSellerPayoutProfile,
  getSellerStripeAccountId,
  setSellerPayoutProfile,
} from "@/lib/site-config";
import { stripe } from "@/lib/stripe";

function formatMoney(cents: number) {
  return `£${(cents / 100).toFixed(2)}`;
}

type SearchParams = {
  q?: string;
  status?: "all" | "pending" | "completed";
  from?: string;
  to?: string;
};

function buildQuery(base: SearchParams) {
  const params = new URLSearchParams();
  if (base.q?.trim()) params.set("q", base.q.trim());
  if (base.status && base.status !== "all") params.set("status", base.status);
  if (base.from?.trim()) params.set("from", base.from.trim());
  if (base.to?.trim()) params.set("to", base.to.trim());
  return params.toString();
}

function parseDateStart(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateEnd(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/payouts");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const { q = "", status = "all", from = "", to = "" } = await searchParams;

  async function markPaidAction(formData: FormData) {
    "use server";

    const currentSession = await getServerSession(authOptions);
    if (!currentSession?.user || currentSession.user.role !== Role.ADMIN) {
      return;
    }

    const orderId = String(formData.get("orderId") ?? "").trim();
    const payoutReference = String(formData.get("payoutReference") ?? "").trim();

    if (!orderId) {
      return;
    }

    await markSellerPayoutPaid(orderId, payoutReference || undefined);
    revalidatePath("/admin/payouts");
  }

  async function payNowAction(formData: FormData) {
    "use server";

    const currentSession = await getServerSession(authOptions);
    if (!currentSession?.user || currentSession.user.role !== Role.ADMIN) {
      return;
    }

    if (!stripe) {
      return;
    }

    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) {
      return;
    }

    const payout = await getSellerPayout(orderId);
    if (!payout || payout.status !== "PLATFORM_PENDING" || payout.stripeTransferId) {
      return;
    }

    const sellerStripeAccountId = await getSellerStripeAccountId(payout.sellerId);
    if (!sellerStripeAccountId) {
      return;
    }

    const transfer = await stripe.transfers.create({
      amount: payout.sellerPayoutCents,
      currency: "gbp",
      destination: sellerStripeAccountId,
      transfer_group: `order_${orderId}`,
      metadata: {
        orderId,
        sellerId: payout.sellerId,
      },
    });

    await markSellerPayoutPaidWithTransfer(orderId, transfer.id);
    revalidatePath("/admin/payouts");
  }

  async function paySelectedAction(formData: FormData) {
    "use server";

    const currentSession = await getServerSession(authOptions);
    if (!currentSession?.user || currentSession.user.role !== Role.ADMIN) {
      return;
    }

    if (!stripe) {
      return;
    }

    const selectedOrderIds = formData
      .getAll("selectedOrderId")
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);

    for (const orderId of selectedOrderIds) {
      const payout = await getSellerPayout(orderId);
      if (!payout || payout.status !== "PLATFORM_PENDING" || payout.stripeTransferId) {
        continue;
      }

      const sellerStripeAccountId = await getSellerStripeAccountId(payout.sellerId);
      if (!sellerStripeAccountId) {
        continue;
      }

      const transfer = await stripe.transfers.create({
        amount: payout.sellerPayoutCents,
        currency: "gbp",
        destination: sellerStripeAccountId,
        transfer_group: `order_${orderId}`,
        metadata: {
          orderId,
          sellerId: payout.sellerId,
        },
      });

      await markSellerPayoutPaidWithTransfer(orderId, transfer.id);
    }

    revalidatePath("/admin/payouts");
  }

  async function saveSellerPayoutDetailsAction(formData: FormData) {
    "use server";

    const currentSession = await getServerSession(authOptions);
    if (!currentSession?.user || currentSession.user.role !== Role.ADMIN) {
      return;
    }

    const sellerId = String(formData.get("sellerId") ?? "").trim();
    if (!sellerId) {
      return;
    }

    await setSellerPayoutProfile(sellerId, {
      method: (String(formData.get("method") ?? "").trim() || undefined) as
        | "STRIPE_CONNECT"
        | "BANK_TRANSFER"
        | "PAYPAL"
        | "MANUAL_REVIEW"
        | undefined,
      payeeName: String(formData.get("payeeName") ?? "").trim() || undefined,
      payoutEmail: String(formData.get("payoutEmail") ?? "").trim() || undefined,
      paypalEmail: String(formData.get("paypalEmail") ?? "").trim() || undefined,
      bankName: String(formData.get("bankName") ?? "").trim() || undefined,
      bankAccountLast4:
        String(formData.get("bankAccountLast4") ?? "")
          .replace(/\D/g, "")
          .slice(0, 4) || undefined,
      bankSortCodeLast2:
        String(formData.get("bankSortCodeLast2") ?? "")
          .replace(/\D/g, "")
          .slice(0, 2) || undefined,
      adminNotes: String(formData.get("adminNotes") ?? "").trim() || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    });

    revalidatePath("/admin/payouts");
  }

  const payouts = await listSellerPayouts();
  const sellerIds = [...new Set(payouts.map((entry) => entry.sellerId))];
  const orderIds = [...new Set(payouts.map((entry) => entry.orderId))];

  const [sellers, orders] = await Promise.all([
    sellerIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, displayName: true, email: true },
        })
      : Promise.resolve([]),
    orderIds.length > 0
      ? prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, status: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const sellerById = new Map(sellers.map((seller) => [seller.id, seller.displayName ?? seller.email]));
  const orderById = new Map(orders.map((order) => [order.id, order]));

  const sellerConnectAccounts = new Map(
    await Promise.all(
      sellerIds.map(async (sellerId) => [sellerId, await getSellerStripeAccountId(sellerId)] as const),
    ),
  );
  const sellerPayoutProfiles = new Map(
    await Promise.all(
      sellerIds.map(async (sellerId) => [sellerId, await getSellerPayoutProfile(sellerId)] as const),
    ),
  );

  const normalizedQuery = q.trim().toLowerCase();
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);
  const filteredPayouts = payouts.filter((entry) => {
    const statusMatch =
      status === "pending"
        ? entry.status === "PLATFORM_PENDING"
        : status === "completed"
          ? entry.status !== "PLATFORM_PENDING"
          : true;

    if (!statusMatch) return false;

    if (fromDate || toDate) {
      const createdAt = new Date(entry.createdAt);
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;
    }

    if (!normalizedQuery) return true;

    const sellerName = (sellerById.get(entry.sellerId) ?? entry.sellerId).toLowerCase();
    return (
      entry.orderId.toLowerCase().includes(normalizedQuery) ||
      entry.sellerId.toLowerCase().includes(normalizedQuery) ||
      sellerName.includes(normalizedQuery) ||
      (entry.payoutReference ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  const pending = filteredPayouts.filter((entry) => entry.status === "PLATFORM_PENDING");
  const completed = filteredPayouts.filter((entry) => entry.status !== "PLATFORM_PENDING");
  const pendingPayoutTotalCents = pending.reduce((sum, entry) => sum + entry.sellerPayoutCents, 0);
  const completedPayoutTotalCents = completed.reduce((sum, entry) => sum + entry.sellerPayoutCents, 0);
  const platformFeesTotalCents = filteredPayouts.reduce((sum, entry) => sum + entry.platformFeeCents, 0);

  const allQuery = buildQuery({ q, status: "all", from, to });
  const pendingQuery = buildQuery({ q, status: "pending", from, to });
  const completedQuery = buildQuery({ q, status: "completed", from, to });
  const exportQuery = new URLSearchParams();
  if (q.trim()) exportQuery.set("q", q.trim());
  if (status !== "all") exportQuery.set("status", status);
  if (from.trim()) exportQuery.set("from", from.trim());
  if (to.trim()) exportQuery.set("to", to.trim());
  exportQuery.set("format", "csv");

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 text-slate-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold">Seller Payout Queue</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/payouts/manual" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Manual Seller Payout
          </Link>
          <Link
            href={`/api/admin/payouts?${exportQuery.toString()}`}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm"
          >
            Export CSV
          </Link>
          <Link href="/admin" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Back to Admin
          </Link>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <form className="flex flex-wrap items-end gap-3" method="GET" action="/admin/payouts">
          <div className="min-w-72">
            <label htmlFor="q" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Order ID, seller, reference"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="from" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <input type="hidden" name="status" value={status} />
          <button type="submit" className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600">
            Apply
          </button>
          {q || from || to ? (
            <Link href="/admin/payouts" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
              Clear
            </Link>
          ) : null}
        </form>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href={allQuery ? `/admin/payouts?${allQuery}` : "/admin/payouts"}
            className={`rounded-full border px-3 py-1 ${status === "all" ? "border-slate-400 bg-slate-800 text-white" : "border-slate-700 text-slate-300"}`}
          >
            All
          </Link>
          <Link
            href={pendingQuery ? `/admin/payouts?${pendingQuery}` : "/admin/payouts?status=pending"}
            className={`rounded-full border px-3 py-1 ${status === "pending" ? "border-amber-400 bg-amber-950 text-amber-100" : "border-slate-700 text-slate-300"}`}
          >
            Pending
          </Link>
          <Link
            href={completedQuery ? `/admin/payouts?${completedQuery}` : "/admin/payouts?status=completed"}
            className={`rounded-full border px-3 py-1 ${status === "completed" ? "border-emerald-400 bg-emerald-950 text-emerald-100" : "border-slate-700 text-slate-300"}`}
          >
            Completed
          </Link>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Visible Records</p>
          <p className="mt-2 text-2xl font-semibold">{filteredPayouts.length}</p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pending Payout Total</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{formatMoney(pendingPayoutTotalCents)}</p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Completed Payout Total</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{formatMoney(completedPayoutTotalCents)}</p>
        </article>
        <article className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Platform Fees</p>
          <p className="mt-2 text-2xl font-semibold text-sky-300">{formatMoney(platformFeesTotalCents)}</p>
        </article>
      </section>

      <section className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
        <h2 className="text-lg font-semibold text-amber-200">Pending Manual Payouts</h2>
        <p className="mt-1 text-sm text-amber-100/80">Orders without Connect split are queued here until payout is sent.</p>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-amber-100/75">Select entries with available Stripe payout, then submit once.</p>
            <form id="bulk-payout-form" action={paySelectedAction}>
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Pay Selected via Stripe
              </button>
            </form>
          </div>
          {pending.length === 0 ? <p className="text-sm text-slate-300">No pending payouts.</p> : null}
          {pending.map((entry) => {
            const sellerName = sellerById.get(entry.sellerId) ?? entry.sellerId;
            const order = orderById.get(entry.orderId);
            const sellerConnectAccountId = sellerConnectAccounts.get(entry.sellerId) ?? null;
            const payoutProfile = sellerPayoutProfiles.get(entry.sellerId) ?? {};
            const canStripePayout = Boolean(stripe && sellerConnectAccountId);
            return (
              <article key={entry.orderId} className="rounded-lg border border-amber-600/40 bg-slate-950/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {canStripePayout ? (
                      <label className="mb-2 flex items-center gap-2 text-xs text-amber-100/85">
                        <input
                          type="checkbox"
                          name="selectedOrderId"
                          value={entry.orderId}
                          form="bulk-payout-form"
                          className="h-4 w-4"
                        />
                        Include in bulk Stripe payout
                      </label>
                    ) : null}
                    <p className="text-sm font-semibold">{sellerName}</p>
                    <p className="text-xs text-slate-400">Order: {entry.orderId}</p>
                    <p className="text-xs text-slate-400">Order status: {order?.status ?? "unknown"}</p>
                    <p className="text-xs text-slate-400">Created: {new Date(entry.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-slate-400">
                      Stripe payout: {canStripePayout ? "available" : "not available"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Method: {payoutProfile.method ?? "not provided"} · Payee: {payoutProfile.payeeName ?? "not provided"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Contact: {payoutProfile.payoutEmail ?? payoutProfile.paypalEmail ?? "not provided"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-slate-300">Gross {formatMoney(entry.grossCents)}</p>
                    <p className="text-slate-300">Platform fee {formatMoney(entry.platformFeeCents)}</p>
                    <p className="font-semibold text-emerald-300">Seller payout {formatMoney(entry.sellerPayoutCents)}</p>
                  </div>
                </div>

                <form action={markPaidAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="orderId" value={entry.orderId} />
                  <input
                    name="payoutReference"
                    type="text"
                    placeholder="Payout reference (optional)"
                    className="min-w-60 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Mark Paid
                  </button>
                </form>

                {canStripePayout ? (
                  <form action={payNowAction} className="mt-2">
                    <input type="hidden" name="orderId" value={entry.orderId} />
                    <button
                      type="submit"
                      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Pay via Stripe Transfer
                    </button>
                  </form>
                ) : null}

                <form action={saveSellerPayoutDetailsAction} className="mt-3 rounded-md border border-slate-700 bg-slate-900/60 p-3">
                  <input type="hidden" name="sellerId" value={entry.sellerId} />
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin payout details</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-400">Method</span>
                      <select
                        name="method"
                        defaultValue={payoutProfile.method ?? ""}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                      >
                        <option value="">Not set</option>
                        <option value="STRIPE_CONNECT">Stripe Connect</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="PAYPAL">PayPal</option>
                        <option value="MANUAL_REVIEW">Manual review</option>
                      </select>
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-400">Payee name</span>
                      <input
                        name="payeeName"
                        defaultValue={payoutProfile.payeeName ?? ""}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-400">Payout email</span>
                      <input
                        name="payoutEmail"
                        defaultValue={payoutProfile.payoutEmail ?? ""}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-400">PayPal email</span>
                      <input
                        name="paypalEmail"
                        defaultValue={payoutProfile.paypalEmail ?? ""}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-400">Bank name</span>
                      <input
                        name="bankName"
                        defaultValue={payoutProfile.bankName ?? ""}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-400">Bank account last 4</span>
                      <input
                        name="bankAccountLast4"
                        defaultValue={payoutProfile.bankAccountLast4 ?? ""}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-400">Sort code last 2</span>
                      <input
                        name="bankSortCodeLast2"
                        defaultValue={payoutProfile.bankSortCodeLast2 ?? ""}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="mt-2 block text-xs">
                    <span className="mb-1 block text-slate-400">Seller notes</span>
                    <textarea
                      name="notes"
                      defaultValue={payoutProfile.notes ?? ""}
                      rows={2}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="mt-2 block text-xs">
                    <span className="mb-1 block text-slate-400">Admin notes</span>
                    <textarea
                      name="adminNotes"
                      defaultValue={payoutProfile.adminNotes ?? ""}
                      rows={2}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                    />
                  </label>
                  <button type="submit" className="mt-2 rounded-md border border-slate-600 px-3 py-2 text-sm">
                    Save details
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Completed / Auto-Split Payouts</h2>
        <div className="mt-4 space-y-3">
          {completed.length === 0 ? <p className="text-sm text-slate-400">No completed payout records yet.</p> : null}
          {completed.map((entry) => {
            const sellerName = sellerById.get(entry.sellerId) ?? entry.sellerId;
            const modeLabel =
              entry.status === "SPLIT_AT_CHARGE"
                ? "Split at charge"
                : entry.status === "CANCELLED"
                  ? "Cancelled after refund"
                  : "Paid out";
            return (
              <article key={entry.orderId} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{sellerName}</p>
                    <p className="text-xs text-slate-400">Order: {entry.orderId}</p>
                    <p className="text-xs text-slate-400">Mode: {modeLabel}</p>
                    {entry.payoutReference ? <p className="text-xs text-slate-400">Reference: {entry.payoutReference}</p> : null}
                    {entry.stripeTransferId ? <p className="text-xs text-slate-400">Transfer: {entry.stripeTransferId}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-300">{formatMoney(entry.sellerPayoutCents)}</p>
                    <p className="text-xs text-slate-400">Updated: {new Date(entry.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
