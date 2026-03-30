import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/payout-queue");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  const { id } = await params;
  const { tab } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
      sellerApplication: {
        select: { id: true },
      },
      _count: {
        select: {
          products: true,
          sellerOrders: true,
          buyerOrders: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const latestPayoutOrders = await prisma.order.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      totalCents: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">User profile</h1>
        <Link href="/admin/payout-queue" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
          Back to payout queue
        </Link>
      </div>

      <section className="mb-6 rounded-md border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-300">Name: {user.displayName ?? "Not set"}</p>
        <p className="text-sm text-slate-300">Email: {user.email}</p>
        <p className="text-sm text-slate-300">Role: {user.role}</p>
        <p className="text-sm text-slate-300">Joined: {user.createdAt.toLocaleString("en-GB")}</p>
      </section>

      <section className="mb-6 rounded-md border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-medium">Account activity</h2>
        <p className="text-sm text-slate-300">Products: {user._count.products}</p>
        <p className="text-sm text-slate-300">Seller applications: {user.sellerApplication ? 1 : 0}</p>
        <p className="text-sm text-slate-300">Orders as seller: {user._count.sellerOrders}</p>
        <p className="text-sm text-slate-300">Orders as buyer: {user._count.buyerOrders}</p>
      </section>

      {(tab === "payouts" || latestPayoutOrders.length > 0) && (
        <section className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-medium">Recent seller orders</h2>
          {latestPayoutOrders.length === 0 ? (
            <p className="text-sm text-slate-400">No seller orders available for this user yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-300">
              {latestPayoutOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between rounded border border-slate-700 px-3 py-2">
                  <span>
                    {order.id.slice(0, 8)} • {order.status}
                  </span>
                  <span>£{(order.totalCents / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
