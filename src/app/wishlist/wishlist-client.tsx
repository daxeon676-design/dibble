"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SavedItem = { id: string; label: string; href: string };

const STORAGE_KEY = "dibble:wishlist-products";

function readWishlist(): SavedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWishlist(next: SavedItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export default function WishlistClient() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "az">("recent");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setItems(readWishlist());
    setMounted(true);
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? items.filter((item) => item.label.toLowerCase().includes(normalized))
      : items;

    if (sortBy === "az") {
      return [...base].sort((a, b) => a.label.localeCompare(b.label));
    }

    return base;
  }, [items, query, sortBy]);

  function removeItem(itemId: string) {
    const next = items.filter((item) => item.id !== itemId);
    setItems(next);
    writeWishlist(next);
    setMessage("Item removed from wishlist.");
  }

  function clearWishlist() {
    setItems([]);
    writeWishlist([]);
    setMessage("Wishlist cleared.");
  }

  async function addToCart(item: SavedItem) {
    setBusyItemId(item.id);
    setMessage(null);

    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.id, quantity: 1 }),
      });

      if (response.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent("/wishlist")}`;
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(payload?.error ?? "Could not add this item to cart.");
        return;
      }

      setMessage("Added to cart.");
    } finally {
      setBusyItemId(null);
    }
  }

  if (!mounted) {
    return <div className="rounded border border-(--accent-terra)/30 bg-(--accent-beige)/40 p-6 animate-pulse" />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded border border-(--accent-terra) bg-(--accent-beige) p-6 text-center text-(--accent-terra)">
        No items in your wishlist yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-(--accent-terra)/30 bg-(--accent-beige)/35 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-md">
          <label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Search wishlist</label>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find saved products"
            className="rounded-md border border-(--accent-terra)/30 bg-white px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-foreground/60">Sort</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "recent" | "az")}
              className="mt-1 rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm"
            >
              <option value="recent">Recently saved</option>
              <option value="az">A to Z</option>
            </select>
          </div>
          <button
            type="button"
            onClick={clearWishlist}
            className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-xs font-semibold text-(--accent-terra) hover:bg-white/70"
          >
            Clear all
          </button>
        </div>
      </div>

      <p className="text-xs text-foreground/55">
        Showing {filteredItems.length} of {items.length} saved item{items.length === 1 ? "" : "s"}.
      </p>

      {message ? (
        <p className="rounded-md border border-(--accent-terra)/30 bg-white px-3 py-2 text-sm text-(--accent-terra)">{message}</p>
      ) : null}

      {filteredItems.length === 0 ? (
        <div className="rounded border border-(--accent-terra)/40 bg-(--accent-beige) p-4 text-sm text-(--accent-terra)">
          No matches for your current search.
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredItems.map((item) => (
            <li key={item.id} className="rounded-xl border border-(--accent-terra)/40 bg-(--accent-beige) p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href={item.href} className="font-medium text-(--accent-terra) underline">
                  {item.label}
                </Link>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addToCart(item)}
                    disabled={busyItemId === item.id}
                    className="rounded-md bg-(--accent-terra) px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {busyItemId === item.id ? "Adding..." : "Add to cart"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-md border border-(--accent-terra)/50 px-3 py-1.5 text-xs font-semibold text-(--accent-terra)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
