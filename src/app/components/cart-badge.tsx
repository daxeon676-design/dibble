"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function CartBadge() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    async function loadCart() {
      try {
        const response = await fetch("/api/cart");
        if (response.ok) {
          const data = (await response.json()) as {
            cart?: { items: Array<{ quantity: number }> } | null;
          };
          const items = data.cart?.items ?? [];
          const count = items.reduce((sum, item) => sum + item.quantity, 0);
          setCartCount(count);
        }
      } catch (error) {
        console.error("Failed to load cart:", error);
      }
    }

    loadCart();
  }, []);

  return (
    <Link href="/buyer/cart" className="relative inline-flex items-center hover:text-(--accent-terra)">
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      {cartCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-(--accent-terra) text-xs font-bold text-(--accent-beige)">
          {cartCount}
        </span>
      )}
    </Link>
  );
}
