import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BuyerOrderActions } from "@/app/buyer/orders/buyer-order-actions";
import OrderStatusTracker from "@/app/components/order-status-tracker";

export default async function BuyerOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/buyer/orders");
  }

  const orders = await prisma.order.findMany({
    where: { buyerId: session.user.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              title: true,
            },
          },
        },
      },
      seller: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      payment: true,
      dispute: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 text-slate-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold">My Orders</h1>
        <Link href="/buyer/marketplace" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
          Back to Marketplace
        </Link>
      </div>

      <div className="space-y-6">
        {orders.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <p className="text-xl mb-2">No orders yet</p>
            <Link href="/buyer/marketplace" className="text-emerald-400 hover:underline text-sm">
              Browse the marketplace
            </Link>
          </div>
        ) : null}
        {orders.map((order) => (
          <article key={order.id} className="rounded-md border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold">
                  Order #{order.id.slice(0, 8).toUpperCase()}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(order.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                  {" · "}
                  <Link href={`/shop/${order.seller.id}`} className="text-emerald-400 hover:underline">
                    {order.seller.displayName ?? order.seller.email}
                  </Link>
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-200">
                £{(order.totalCents / 100).toFixed(2)}
              </span>
            </div>

            {/* Status tracker */}
            <div className="mb-4 bg-slate-800 rounded p-3">
              <OrderStatusTracker status={order.status} />
            </div>

            {/* Items */}
            <ul className="space-y-1 mb-4">
              {order.items.map((item) => (
                <li key={item.id} className="text-sm text-slate-300 flex justify-between">
                  <span>{item.product.title} × {item.quantity}</span>
                  <span className="text-slate-400">£{((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2 items-center">
              <BuyerOrderActions orderId={order.id} canPay={order.status === "PENDING_PAYMENT"} />

              {order.payment?.status === "SUCCEEDED" ? (
                <a
                  href={`/api/orders/${order.id}/invoice`}
                  className="text-xs border border-slate-600 rounded px-3 py-1.5 hover:bg-slate-800"
                >
                  Download Invoice
                </a>
              ) : null}

              {/* Message seller */}
              <Link
                href={`/buyer/messages/new`}
                className="text-xs border border-slate-600 rounded px-3 py-1.5 hover:bg-slate-800"
              >
                Message Seller
              </Link>

              {/* Raise dispute (only for processing/delivered orders without one) */}
              {(order.status === "PROCESSING" || order.status === "SHIPPED" || order.status === "DELIVERED") &&
                !order.dispute && (
                  <Link
                    href={`/buyer/disputes/new`}
                    className="text-xs border border-red-700 text-red-400 rounded px-3 py-1.5 hover:bg-red-900/20"
                  >
                    Raise Dispute
                  </Link>
                )}

              {order.dispute && (
                <span className="text-xs text-yellow-400 border border-yellow-700 rounded px-2 py-1">
                  Dispute: {order.dispute.status.replace("_", " ")}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
