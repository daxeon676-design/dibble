import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSellerPayoutProfiles, getSellerStripeAccountId, setSellerPayoutProfile } from "@/lib/site-config";

type SearchParams = {
  q?: string;
  method?: "all" | "STRIPE_CONNECT" | "BANK_TRANSFER" | "PAYPAL" | "MANUAL_REVIEW";
};

export const metadata: Metadata = { title: "Payout Profiles - Admin" };

export default async function AdminPayoutProfilesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/payout-profiles");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const { q = "", method = "all" } = await searchParams;

  async function saveProfileAction(formData: FormData) {
    "use server";

    const currentSession = await getServerSession(authOptions);
    if (!currentSession?.user || currentSession.user.role !== Role.ADMIN) {
      return;
    }

    const sellerId = String(formData.get("sellerId") ?? "").trim();
    if (!sellerId) return;

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
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      adminNotes: String(formData.get("adminNotes") ?? "").trim() || undefined,
    });

    revalidatePath("/admin/payout-profiles");
    revalidatePath("/admin/payouts");
  }

  const sellers = await prisma.user.findMany({
    where: { role: Role.SELLER },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const payoutProfiles = await getSellerPayoutProfiles();
  const stripeAccountMap = new Map(
    await Promise.all(sellers.map(async (seller) => [seller.id, await getSellerStripeAccountId(seller.id)] as const)),
  );

  const normalizedQuery = q.trim().toLowerCase();

  const filteredSellers = sellers.filter((seller) => {
    const profile = payoutProfiles[seller.id] ?? {};

    if (method !== "all" && profile.method !== method) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      seller.id.toLowerCase().includes(normalizedQuery) ||
      (seller.displayName ?? "").toLowerCase().includes(normalizedQuery) ||
      seller.email.toLowerCase().includes(normalizedQuery) ||
      (profile.payeeName ?? "").toLowerCase().includes(normalizedQuery) ||
      (profile.payoutEmail ?? "").toLowerCase().includes(normalizedQuery) ||
      (profile.paypalEmail ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-slate-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold">Seller Payout Profiles</h1>
        <div className="flex gap-2">
          <Link href="/admin/payouts" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Payout Queue
          </Link>
          <Link href="/admin" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Back to Admin
          </Link>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <form method="GET" action="/admin/payout-profiles" className="flex flex-wrap items-end gap-3">
          <div className="min-w-72">
            <label htmlFor="q" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search seller or payout details
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Seller name, email, payee"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="method" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Method
            </label>
            <select
              id="method"
              name="method"
              defaultValue={method}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="all">All methods</option>
              <option value="STRIPE_CONNECT">Stripe Connect</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="PAYPAL">PayPal</option>
              <option value="MANUAL_REVIEW">Manual review</option>
            </select>
          </div>
          <button type="submit" className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600">
            Apply
          </button>
          {q || method !== "all" ? (
            <Link href="/admin/payout-profiles" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
              Clear
            </Link>
          ) : null}
        </form>
      </section>

      <section className="space-y-4">
        {filteredSellers.length === 0 ? <p className="text-sm text-slate-400">No sellers match the current filters.</p> : null}

        {filteredSellers.map((seller) => {
          const profile = payoutProfiles[seller.id] ?? {};
          const stripeAccount = stripeAccountMap.get(seller.id);

          return (
            <article key={seller.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{seller.displayName ?? seller.email}</p>
                  <p className="text-xs text-slate-400">{seller.email}</p>
                  <p className="text-xs text-slate-500">Seller ID: {seller.id}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-slate-400">Stripe account: {stripeAccount ?? "not connected"}</p>
                  <p className="text-slate-400">Updated: {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "never"}</p>
                </div>
              </div>

              <form action={saveProfileAction} className="rounded-md border border-slate-700 bg-slate-950/70 p-3">
                <input type="hidden" name="sellerId" value={seller.id} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-400">Method</span>
                    <select name="method" defaultValue={profile.method ?? ""} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
                      <option value="">Not set</option>
                      <option value="STRIPE_CONNECT">Stripe Connect</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="PAYPAL">PayPal</option>
                      <option value="MANUAL_REVIEW">Manual review</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-400">Payee name</span>
                    <input name="payeeName" defaultValue={profile.payeeName ?? ""} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-400">Payout email</span>
                    <input name="payoutEmail" defaultValue={profile.payoutEmail ?? ""} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-400">PayPal email</span>
                    <input name="paypalEmail" defaultValue={profile.paypalEmail ?? ""} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-400">Bank name</span>
                    <input name="bankName" defaultValue={profile.bankName ?? ""} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-400">Bank account last 4</span>
                    <input name="bankAccountLast4" defaultValue={profile.bankAccountLast4 ?? ""} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-400">Sort code last 2</span>
                    <input name="bankSortCodeLast2" defaultValue={profile.bankSortCodeLast2 ?? ""} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
                  </label>
                </div>
                <label className="mt-2 block text-xs">
                  <span className="mb-1 block text-slate-400">Seller notes</span>
                  <textarea name="notes" defaultValue={profile.notes ?? ""} rows={2} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
                </label>
                <label className="mt-2 block text-xs">
                  <span className="mb-1 block text-slate-400">Admin notes</span>
                  <textarea name="adminNotes" defaultValue={profile.adminNotes ?? ""} rows={2} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm" />
                </label>
                <button type="submit" className="mt-3 rounded-md border border-slate-600 px-3 py-2 text-sm">
                  Save profile
                </button>
              </form>
            </article>
          );
        })}
      </section>
    </main>
  );
}
