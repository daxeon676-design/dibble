"use client";

import Link from "next/link";
import { useState } from "react";

import { AddToCartButton } from "@/app/buyer/marketplace/product-card-actions";

type Props = {
  productId: string;
  priceCents: number;
  maxQuantity: number;
};

export function ProductDetailActions({ productId, priceCents, maxQuantity }: Props) {
  const [quantity, setQuantity] = useState(1);
  const totalPrice = (priceCents * quantity) / 100;

  return (
    <div className="rounded-xl border border-(--accent-terra)/30 bg-(--accent-beige)/35 p-5">
      <label className="block text-sm font-medium text-foreground">
        <span>Quantity</span>
        <input
          type="number"
          min={1}
          max={Math.max(1, maxQuantity)}
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Math.min(Math.max(1, maxQuantity), Number(event.target.value) || 1)))}
          className="mt-1 w-28 rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
        />
      </label>

      <div className="mt-3 flex items-center justify-between rounded-md bg-white/40 px-3 py-2">
        <span className="text-sm text-(--accent-green)">Total Price:</span>
        <span className="text-lg font-semibold text-(--accent-terra)">£{totalPrice.toFixed(2)}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AddToCartButton productId={productId} quantity={quantity} idleLabel="Add to Basket" />
        <Link href="/buyer/cart" className="rounded-md border border-(--accent-terra) px-3 py-1 text-sm text-(--accent-terra) hover:bg-(--accent-beige)">
          View Basket
        </Link>
      </div>
    </div>
  );
}