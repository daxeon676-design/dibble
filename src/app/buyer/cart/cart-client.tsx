"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CartData = {
  id: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPriceCts: number;
    variantId?: string | null;
    variantLabel?: string | null;
    product: {
      id: string;
      title: string;
      stock: number;
      imageUrls: string[];
    };
  }>;
} | null;

type Props = {
  initialCart: CartData;
};

export function BuyerCartClient({ initialCart }: Props) {
  const [data, setData] = useState<CartData>(initialCart);
  const [error, setError] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "error">("idle");

  async function loadCart() {
    const response = await fetch("/api/cart");
    const body = (await response.json().catch(() => null)) as { cart?: CartData } | null;

    if (!response.ok) {
      setError("Failed to load cart.");
      return;
    }

    setData(body?.cart ?? null);
  }

  const subtotal = useMemo(() => {
    return (data?.items ?? []).reduce((sum, item) => sum + item.unitPriceCts * item.quantity, 0);
  }, [data]);

  async function setItemQty(itemId: string, quantity: number) {
    const response = await fetch(`/api/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });

    if (!response.ok) {
      setError("Could not update quantity.");
      return;
    }

    await loadCart();
  }

  async function removeItem(itemId: string) {
    const response = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });

    if (!response.ok) {
      setError("Could not remove item.");
      return;
    }

    await loadCart();
  }

  async function checkout() {
    setCheckoutState("loading");
    // Redirect to checkout page where delivery options will be selected
    window.location.href = "/buyer/checkout";
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-slate-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold">Your Cart</h1>
        <div className="flex gap-2">
          <Link href="/buyer/marketplace" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            Continue Shopping
          </Link>
          <Link href="/buyer/orders" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
            My Orders
          </Link>
        </div>
      </div>

      {error ? <p className="text-red-300">{error}</p> : null}

      {(data?.items.length ?? 0) === 0 ? (
        <div className="rounded-md border border-slate-700 bg-slate-900 p-6 text-center">
          <p className="text-lg text-slate-300">Your cart is empty</p>
          <p className="mt-2 text-sm text-slate-400">Add some items to get started</p>
          <Link href="/buyer/marketplace" className="mt-4 inline-block rounded-md border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.items ?? []).map((item) => (
            <article key={item.id} className="rounded-md border border-slate-800 bg-slate-900 p-4 flex gap-4">
              {item.product.imageUrls[0] && (
                <div className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.product.imageUrls[0]}
                    alt={item.product.title}
                    className="h-24 w-24 rounded-md border border-slate-700 object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{item.product.title}</h2>
                {item.variantLabel ? <p className="text-xs text-slate-400">Variant: {item.variantLabel}</p> : null}
                <p className="text-sm text-slate-300">£{(item.unitPriceCts / 100).toFixed(2)} each</p>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-sm">Qty</label>
                  <input
                    type="number"
                    min={1}
                    max={item.product.stock}
                    value={item.quantity}
                    onChange={(event) => setItemQty(item.id, Number(event.target.value))}
                    className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-md bg-red-500 px-3 py-1 text-sm font-semibold text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-md border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-300">Subtotal: £{(subtotal / 100).toFixed(2)}</p>
        <p className="text-lg font-semibold mt-2">Total: £{(subtotal / 100).toFixed(2)}</p>
        <button
          type="button"
          disabled={checkoutState === "loading" || (data?.items.length ?? 0) === 0}
          onClick={checkout}
          className="mt-3 rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
        >
          {checkoutState === "loading" ? "Redirecting to checkout..." : "Proceed to Checkout"}
        </button>
        {checkoutState === "error" ? <p className="mt-2 text-sm text-red-300">Error redirecting to checkout.</p> : null}
      </div>
    </main>
  );
}
