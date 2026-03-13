"use client";

import Link from "next/link";
import { useState } from "react";

type SavedItem = { id: string; label: string; href: string };

export default function WishlistClient() {
  const [items] = useState<SavedItem[]>(() => {
    try {
      const raw = window.localStorage.getItem("dibble:wishlist-products");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavedItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  if (items.length === 0) {
    return (
      <div className="rounded border border-(--accent-terra) bg-(--accent-beige) p-6 text-center text-(--accent-terra)">
        No items in your wishlist yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded border border-(--accent-terra)/40 bg-(--accent-beige) p-3">
          <Link href={item.href} className="font-medium text-(--accent-terra) underline">
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
