import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { reconcileSellerPayouts } from "@/lib/payout-reconciliation";
import { getLastReconciliationReport, saveReconciliationReport } from "@/lib/reconciliation-report-store";

export const metadata: Metadata = { title: "Payout Reconciliation - Admin" };

export default async function PayoutReconciliationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/payout-reconciliation");
  }

  async function runReconciliationNowAction() {
    "use server";

    const currentSession = await getServerSession(authOptions);
    if (!currentSession?.user || currentSession.user.role !== "ADMIN") {
      return;
    }

    const latest = await reconcileSellerPayouts();
    await saveReconciliationReport({
      generatedAt: latest.generatedAt,
      source: "manual",
      summary: latest.summary,
      issuesPreview: latest.issues.slice(0, 25),
    });

    revalidatePath("/admin/payout-reconciliation");
    revalidatePath("/admin/ops");
  }

  const result = await reconcileSellerPayouts();
  const lastSaved = await getLastReconciliationReport();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold text-(--accent-terra)">Payout Reconciliation</h1>
          <p className="mt-1 text-sm text-foreground/70">Cross-checks payout ledger entries against payment states and Stripe transfers.</p>
        </div>
        <div className="flex gap-2">
          <form action={runReconciliationNowAction}>
            <button type="submit" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
              Run Reconciliation Now
            </button>
          </form>
          <Link href="/admin/ops" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Back to Ops
          </Link>
          <Link href="/api/admin/payouts/reconcile" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Raw JSON
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-md border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Scanned</p>
          <p className="mt-1 text-2xl font-semibold">{result.summary.scanned}</p>
        </article>
        <article className="rounded-md border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Paid Out</p>
          <p className="mt-1 text-2xl font-semibold">{result.summary.paidOutCount}</p>
        </article>
        <article className="rounded-md border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Pending</p>
          <p className="mt-1 text-2xl font-semibold">{result.summary.pendingCount}</p>
        </article>
        <article className="rounded-md border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Issues</p>
          <p className={`mt-1 text-2xl font-semibold ${result.summary.issuesCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {result.summary.issuesCount}
          </p>
        </article>
        <article className="rounded-md border border-(--accent-terra)/25 bg-white p-4">
          <p className="text-xs uppercase text-foreground/50">Generated</p>
          <p className="mt-1 text-sm font-semibold">{new Date(result.generatedAt).toLocaleString("en-GB")}</p>
        </article>
      </section>

      <section className="mt-4 rounded-xl border border-(--accent-terra)/25 bg-white p-4">
        <h2 className="text-sm font-semibold text-(--accent-terra)">Last Persisted Reconciliation Run</h2>
        <p className="mt-1 text-xs text-foreground/70">
          {lastSaved?.generatedAt
            ? `${new Date(lastSaved.generatedAt).toLocaleString("en-GB")} (${lastSaved.source})`
            : "No persisted run yet"}
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-(--accent-terra)/25 bg-white p-5">
        <h2 className="text-lg font-semibold text-(--accent-terra)">Issues</h2>
        <div className="mt-3 space-y-2">
          {result.issues.length === 0 ? <p className="text-sm text-foreground/60">No issues found.</p> : null}
          {result.issues.map((issue) => (
            <article key={`${issue.orderId}-${issue.type}`} className="rounded-md border border-(--accent-terra)/20 p-3 text-sm">
              <p className="font-semibold text-red-700">{issue.type}</p>
              <p className="mt-1 text-foreground/70">Order: {issue.orderId}</p>
              <p className="text-foreground/70">Seller: {issue.sellerId}</p>
              <p className="mt-1 text-foreground/80">{issue.details}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
