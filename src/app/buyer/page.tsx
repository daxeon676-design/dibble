/* eslint-disable react/no-unescaped-entities */
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Buyer Dashboard – Dibble" };

export default async function BuyerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/buyer");

  // Parallel fetch: recent orders + cart item count + unread messages
  const [recentOrders, cartItemCount, unreadConversations] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        seller: { select: { displayName: true, email: true } },
        items: { select: { quantity: true } },
        dispute: { select: { status: true } },
      },
    }),
    prisma.cartItem.count({ where: { cart: { is: { buyerId: session.user.id } } } }),
    prisma.conversationParticipant.count({
      where: {
        userId: session.user.id,
        readAt: null,
        conversation: {
          messages: {
            some: {
              sender: { id: { not: session.user.id } },
            },
          },
        },
      },
    }),
  ]);

  const statusColors: Record<string, string> = {
    PENDING_PAYMENT: "text-yellow-400",
    PROCESSING: "text-blue-400",
    SHIPPED: "text-purple-400",
    DELIVERED: "text-green-400",
    CANCELLED: "text-red-400",
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-slate-100">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">
          Welcome back{session.user.name ? `, ${session.user.name}` : ""}!
        </h1>
        <p className="mt-1 text-slate-400">{session.user.email}</p>
      </div>

      {/* Quick-action cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-10">
        <Link
          href="/buyer/marketplace"
          className="rounded-lg border border-slate-700 bg-slate-900 p-4 hover:bg-slate-800 transition text-center"
        >
          <p className="text-2xl mb-1">🛒</p>
          <p className="text-sm font-medium">Browse</p>
        </Link>
        <Link
          href="/buyer/cart"
          className="rounded-lg border border-slate-700 bg-slate-900 p-4 hover:bg-slate-800 transition text-center relative"
        >
          <p className="text-2xl mb-1">🧺</p>
          <p className="text-sm font-medium">Cart</p>
          {cartItemCount > 0 && (
            <span className="absolute top-2 right-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {cartItemCount}
            </span>
          )}
        </Link>
        <Link
          href="/buyer/messages"
          className="rounded-lg border border-slate-700 bg-slate-900 p-4 hover:bg-slate-800 transition text-center relative"
        >
          <p className="text-2xl mb-1">💬</p>
          <p className="text-sm font-medium">Messages</p>
          {unreadConversations > 0 && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadConversations}
            </span>
          )}
        </Link>
        <Link
          href="/buyer/profile"
          className="rounded-lg border border-slate-700 bg-slate-900 p-4 hover:bg-slate-800 transition text-center"
        >
          <p className="text-2xl mb-1">👤</p>
          <p className="text-sm font-medium">Profile</p>
        </Link>
      </div>

      {/* Recent orders */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Recent Orders</h2>
          <Link href="/buyer/orders" className="text-sm text-emerald-400 hover:underline">
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="border border-slate-800 rounded-md p-6 text-center text-slate-400">
            <p className="mb-2">You haven't placed any orders yet.</p>
            <Link href="/buyer/marketplace" className="text-emerald-400 hover:underline text-sm">
              Start shopping →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => {
              const qty = order.items.reduce((s, i) => s + i.quantity, 0);
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between border border-slate-800 rounded-md px-4 py-3 bg-slate-900"
                >
                  <div>
                    <p className="text-sm font-medium">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-400">
                      {order.seller.displayName ?? order.seller.email} · {qty} item{qty !== 1 && "s"} ·{" "}
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                    {order.dispute && (
                      <p className="text-xs text-yellow-400 mt-0.5">
                        Dispute: {order.dispute.status.replace("_", " ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-semibold ${statusColors[order.status] ?? "text-slate-300"}`}>
                      {order.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-300">
                      £{(order.totalCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Other links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/buyer/following" className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          Following Feed
        </Link>
        <Link href="/buyer/disputes" className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          My Disputes
        </Link>
        <Link href="/buyer/returns" className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          My Returns
        </Link>
        <Link href="/buyer/seller-application" className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950">
          Become a Seller
        </Link>
        <Link href="/seller" className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          Seller Dashboard
        </Link>
        <Link href="/account/mfa" className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          Security (2FA)
        </Link>
        <Link href="/account/email-preferences" className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          Email Preferences
        </Link>
        <Link href="/admin" className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          Admin Dashboard
        </Link>
      </div>
    </main>
  );
}
