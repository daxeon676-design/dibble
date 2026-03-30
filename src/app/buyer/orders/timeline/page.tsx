"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  PENDING_PAYMENT: { bg: "bg-gray-100", text: "text-gray-800", icon: "⏳" },
  PROCESSING: { bg: "bg-blue-100", text: "text-blue-800", icon: "🔄" },
  SHIPPED: { bg: "bg-purple-100", text: "text-purple-800", icon: "📦" },
  DELIVERED: { bg: "bg-green-100", text: "text-green-800", icon: "✅" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-800", icon: "❌" },
};

export default function OrderTimelinePage() {
  const [orders, setOrders] = useState<Array<{
    id: string;
    status: string;
    totalCents: number;
    createdAt: string;
    processingAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    sellerName: string;
    items: Array<{ productId: string; quantity: number; unitPriceCents: number }>
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const response = await fetch("/api/buyer/orders-timeline");
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8">Loading your orders...</div>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-foreground">
      <h1 className="text-4xl font-bold text-foreground">Order Tracking</h1>
      <p className="mt-2 text-foreground/60">View the detailed timeline of your orders and their current status</p>

      <div className="mt-8 space-y-8">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-foreground/60">You haven&apos;t placed any orders yet</p>
            <Link href="/buyer/marketplace" className="mt-4 inline-block text-blue-600 hover:underline">
              Start shopping →
            </Link>
          </div>
        ) : (
          orders.map((order) => {
            const color = statusColors[order.status] || statusColors.PENDING_PAYMENT;
            return (
              <div
                key={order.id}
                className="rounded-lg border border-gray-200 bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Order {order.id.slice(0, 8)}</h2>
                    <p className="mt-1 text-sm text-foreground/60">
                      Placed {new Date(order.createdAt as unknown as string).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-block rounded-lg ${color.bg} px-4 py-2 font-medium ${color.text}`}>
                    {color.icon} {order.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    { status: "PENDING_PAYMENT", label: "Order Created", time: order.createdAt },
                    {
                      status: "PROCESSING",
                      label: "Processing",
                      time: order.processingAt || order.createdAt,
                    },
                    { status: "SHIPPED", label: "Shipped", time: order.shippedAt },
                    { status: "DELIVERED", label: "Delivered", time: order.deliveredAt },
                  ].map((step, i) => {
                    const isCompleted = Object.values(["PENDING_PAYMENT", "PROCESSING", "SHIPPED", "DELIVERED"]).indexOf(
                      step.status
                    ) <
                      Object.values(["PENDING_PAYMENT", "PROCESSING", "SHIPPED", "DELIVERED"]).indexOf(
                        order.status
                      );
                    const isActive = step.status === order.status;

                    return (
                      <div key={step.status} className="flex gap-4">
                        <div className="relative flex flex-col items-center">
                          <div
                            className={`h-4 w-4 rounded-full ${
                              isCompleted || isActive
                                ? "bg-green-500"
                                : "bg-gray-300"
                            }`}
                          />
                          {i < 3 && (
                            <div
                              className={`my-2 h-8 w-1 ${
                                isCompleted ? "bg-green-500" : "bg-gray-300"
                              }`}
                            />
                          )}
                        </div>
                        <div className="pb-2">
                          <p className="font-medium text-foreground">{step.label}</p>
                          {step.time && (
                            <p className="text-sm text-foreground/60">
                              {new Date(step.time).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 border-t border-gray-200 pt-6">
                  <p className="text-sm font-semibold text-foreground/60">Total: £{(order.totalCents / 100).toFixed(2)}</p>
                    <Link
                      href={`/buyer/orders/${order.id}`}
                    className="mt-4 inline-block text-blue-600 hover:underline"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
