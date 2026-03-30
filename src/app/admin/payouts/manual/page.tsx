import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/immutable-audit-log";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

function toCents(amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

export default async function AdminManualPayoutPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/payouts/manual");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  async function submitManualPayout(formData: FormData) {
    "use server";

    const currentSession = await getServerSession(authOptions);
    if (!currentSession?.user || currentSession.user.role !== Role.ADMIN) {
      return;
    }

    if (!stripe) {
      return;
    }

    const sellerId = String(formData.get("sellerId") ?? "").trim();
    const amount = String(formData.get("amount") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    const amountCents = toCents(amount);
    if (!sellerId || !amountCents) {
      return;
    }

    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        stripeConnectAccountId: true,
      },
    });

    if (!seller?.stripeConnectAccountId) {
      return;
    }

    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: "gbp",
      destination: seller.stripeConnectAccountId,
      metadata: {
        sellerId,
        manualPayout: "true",
        notes,
      },
    });

    await logAuditEvent({
      actor: currentSession.user.id,
      action: "MANUAL_SELLER_PAYOUT",
      targetType: "seller",
      targetId: sellerId,
      details: {
        amountCents,
        transferId: transfer.id,
        notes,
      },
    });

    revalidatePath("/admin/payouts");
    revalidatePath("/admin/payouts/manual");
  }

  const sellers = await prisma.user.findMany({
    where: {
      role: Role.SELLER,
      stripeConnectAccountId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      email: true,
      stripeConnectAccountId: true,
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10 text-foreground">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Manual Seller Payout</h1>
        <Link href="/admin/payouts" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm">
          Back to Payouts
        </Link>
      </div>

      <form action={submitManualPayout} className="space-y-4 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/30 p-5">
        <label className="block text-sm">
          <span className="font-medium">Seller</span>
          <select name="sellerId" required className="mt-1 w-full rounded border border-(--accent-terra)/40 px-3 py-2">
            <option value="">Select seller...</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {(seller.displayName ?? seller.email)} ({seller.id.slice(0, 8)})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium">Amount (GBP)</span>
          <input name="amount" type="number" required min="0.01" step="0.01" className="mt-1 w-full rounded border border-(--accent-terra)/40 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Notes</span>
          <textarea name="notes" rows={3} className="mt-1 w-full rounded border border-(--accent-terra)/40 px-3 py-2" placeholder="Reason or reference" />
        </label>

        <button type="submit" className="rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige)">
          Send Manual Payout
        </button>
      </form>
    </main>
  );
}
