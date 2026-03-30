import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PaymentStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewForm } from "@/app/buyer/orders/[id]/review-form";
import OrderStatusTracker from "@/app/components/order-status-tracker";

export default async function BuyerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/buyer/orders");
  }

  if (session.user.role !== Role.BUYER && session.user.role !== Role.ADMIN) {
    redirect("/seller");
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      payment: { select: { status: true } },
    },
  });

  if (!order) {
    notFound();
  }

  if (session.user.role !== Role.ADMIN && order.buyerId !== session.user.id) {
    notFound();
  }

  const productIds = order.items.map((item) => item.product.id);
  const existingReviews = await prisma.review.findMany({
    where: {
      productId: { in: productIds },
      buyerId: session.user.id,
    },
    select: { productId: true, rating: true, body: true },
  });
  const reviewByProductId = Object.fromEntries(existingReviews.map((r) => [r.productId, r]));

  const canReview =
    order.status === "DELIVERED" && order.payment?.status === PaymentStatus.SUCCEEDED;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-foreground">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
        <Link href="/buyer/orders" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm hover:bg-(--accent-beige)/40">
          Back to Orders
        </Link>
      </div>

      <section className="space-y-4 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/40 p-5">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <p>
            <span className="font-medium">Seller: </span>
            <Link href={"/shop/" + order.seller.id} className="text-(--accent-terra) hover:underline">
              {order.seller.displayName ?? order.seller.email}
            </Link>
          </p>
          <p><span className="font-medium">Total: </span>£{(order.totalCents / 100).toFixed(2)}</p>
          <p><span className="font-medium">Placed: </span>{order.createdAt.toLocaleString("en-GB")}</p>
        </div>

        <div className="rounded bg-(--accent-beige)/60 p-3">
          <OrderStatusTracker status={order.status} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Items</p>
          <ul className="space-y-1">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <Link href={"/products/" + item.product.id} className="hover:underline text-(--accent-terra)">
                  {item.product.title}
                </Link>
                <span className="text-foreground/60">× {item.quantity} — £{((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>

        {order.payment?.status === "SUCCEEDED" && (
          <a
            href={"/api/orders/" + order.id + "/invoice"}
            className="inline-block text-xs border border-(--accent-terra)/40 rounded px-3 py-1.5 hover:bg-(--accent-beige)/60"
          >
            Download Invoice
          </a>
        )}
      </section>

      {canReview && (
        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Leave a Review</h2>
          {order.items.map((item) => (
            <ReviewForm
              key={item.product.id}
              productId={item.product.id}
              productTitle={item.product.title}
              existingReview={reviewByProductId[item.product.id] ?? null}
            />
          ))}
        </section>
      )}
    </main>
  );
}