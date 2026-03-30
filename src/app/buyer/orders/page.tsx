import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OrderStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrderStatusTracker from "@/app/components/order-status-tracker";
import { ReorderButton } from "@/app/buyer/orders/reorder-button";

export default async function BuyerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    q?: string;
    status?: OrderStatus | "all";
    seller?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/buyer/orders");
  }

  const params = await searchParams;
  const justCheckedOut = params.checkout === "success";
  const searchText = (params.q ?? "").trim();
  const sellerFilter = (params.seller ?? "").trim();
  const statusFilter = params.status && params.status !== "all" ? params.status : null;
  const fromDate = params.from ? new Date(`${params.from}T00:00:00.000Z`) : null;
  const toDate = params.to ? new Date(`${params.to}T23:59:59.999Z`) : null;

  const orders = await prisma.order.findMany({
    where: {
      buyerId: session.user.id,
      status: { not: OrderStatus.PENDING_PAYMENT },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(sellerFilter
        ? {
            seller: {
              OR: [
                { displayName: { contains: sellerFilter, mode: "insensitive" } },
                { email: { contains: sellerFilter, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(searchText
        ? {
            OR: [
              { id: { contains: searchText, mode: "insensitive" } },
              {
                items: {
                  some: {
                    product: {
                      title: { contains: searchText, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
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
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold">My Orders</h1>
        <Link href="/buyer/marketplace" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm hover:bg-(--accent-beige)/40">
          Back to Marketplace
        </Link>
      </div>

      {justCheckedOut ? (
        <div className="mb-6 rounded-md border border-green-600 bg-green-50 p-4 text-sm text-green-800">
          <strong>Order placed!</strong> Your payment was successful and your order has been sent to the seller.
        </div>
      ) : null}

      <form className="mb-6 grid gap-2 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/30 p-3 md:grid-cols-5">
        <input
          name="q"
          placeholder="Search order ID or product"
          defaultValue={searchText}
          className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={statusFilter ?? "all"} className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="PROCESSING">Processing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <input
          name="seller"
          placeholder="Seller"
          defaultValue={sellerFilter}
          className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="from"
          defaultValue={params.from ?? ""}
          className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="w-full rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-(--accent-terra) px-3 py-2 text-sm font-semibold text-(--accent-beige)">
            Filter
          </button>
          <Link href="/buyer/orders" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm">
            Reset
          </Link>
        </div>
      </form>

      <div className="space-y-6">
        {orders.length === 0 ? (
          <div className="py-20 text-center text-foreground/50">
            <p className="text-xl mb-2">No orders yet</p>
            <Link href="/buyer/marketplace" className="text-(--accent-terra) hover:underline text-sm">
              Browse the marketplace
            </Link>
          </div>
        ) : null}
        {orders.map((order) => (
          <article key={order.id} className="rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold">
                  Order #{order.id.slice(0, 8).toUpperCase()}
                </h2>
                <p className="text-xs text-foreground/50 mt-0.5">
                  {new Date(order.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                  {" · "}
                  <Link href={`/shop/${order.seller.id}`} className="text-(--accent-terra) hover:underline">
                    {order.seller.displayName ?? order.seller.email}
                  </Link>
                </p>
              </div>
              <span className="text-sm font-semibold">
                £{(order.totalCents / 100).toFixed(2)}
              </span>
            </div>

            {/* Status tracker */}
            <div className="mb-4 bg-(--accent-beige)/60 rounded p-3">
              <OrderStatusTracker status={order.status} />
            </div>

            {/* Items */}
            <ul className="space-y-1 mb-4">
              {order.items.map((item) => (
                <li key={item.id} className="text-sm flex justify-between">
                  <span>{item.product.title} × {item.quantity}</span>
                  <span className="text-foreground/60">£{((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2 items-center">
              <ReorderButton orderId={order.id} />
              {order.payment?.status === "SUCCEEDED" ? (
                <a
                  href={`/api/orders/${order.id}/invoice`}
                  className="text-xs border border-(--accent-terra)/40 rounded px-3 py-1.5 hover:bg-(--accent-beige)/60"
                >
                  Download Invoice
                </a>
              ) : null}

              {order.status === "DELIVERED" && order.payment?.status === "SUCCEEDED" ? (
                <Link
                  href="/buyer/returns"
                  className="text-xs border border-emerald-700 text-emerald-400 rounded px-3 py-1.5 hover:bg-emerald-900/20"
                >
                  Request Return
                </Link>
              ) : null}

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
