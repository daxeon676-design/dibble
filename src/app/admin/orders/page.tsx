import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminOrderActions } from "@/app/admin/orders/admin-order-actions";

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/orders");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const orders = await prisma.order.findMany({
    include: {
      buyer: {
        select: { displayName: true, email: true },
      },
      seller: {
        select: { displayName: true, email: true },
      },
      items: {
        include: {
          product: {
            select: { title: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">All Orders</h1>
        <Link href="/admin" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
          Back to Admin Dashboard
        </Link>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? <p className="text-slate-400">No orders yet.</p> : null}

        {orders.map((order) => (
          <article key={order.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold">Order {order.id.slice(0, 8)}</h2>
            <p className="text-sm text-slate-300">Buyer: {order.buyer.displayName ?? order.buyer.email}</p>
            <p className="text-sm text-slate-300">Seller: {order.seller.displayName ?? order.seller.email}</p>
            <p className="text-sm text-slate-300">Status: {order.status}</p>
            <p className="text-sm text-slate-300">Total: £{(order.totalCents / 100).toFixed(2)}</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-400">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.product.title} x {item.quantity}
                </li>
              ))}
            </ul>
            <AdminOrderActions orderId={order.id} />
          </article>
        ))}
      </div>
    </main>
  );
}
