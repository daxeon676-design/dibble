"use client";

import { useState } from "react";

type Props = {
  productId: string;
  quantity?: number;
  variantId?: string | null;
  idleLabel?: string;
};

export function AddToCartButton({ productId, quantity = 1, variantId = null, idleLabel = "Add to Cart" }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function addToCart() {
    setState("loading");
    setErrorMessage(null);

    const response = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity, variantId }),
    });

    if (response.status === 401) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(body?.error ?? "Failed to add");
      setState("error");
      return;
    }

    setState("done");
    setTimeout(() => setState("idle"), 1200);
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={addToCart}
        disabled={state === "loading"}
        className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        {state === "loading" ? "Adding..." : idleLabel}
      </button>
      {state === "done" ? <p className="mt-1 text-xs text-emerald-300">Added</p> : null}
      {state === "error" ? <p className="mt-1 text-xs text-red-300">{errorMessage ?? "Failed to add"}</p> : null}
    </div>
  );
}
