"use client";

import { useState } from "react";

type ListType = "wishlist" | "favourite-products" | "favourite-shops";

type SavedItem = {
  id: string;
  label: string;
  href: string;
};

const STORAGE_KEYS: Record<ListType, string> = {
  wishlist: "dibble:wishlist-products",
  "favourite-products": "dibble:favourite-products",
  "favourite-shops": "dibble:favourite-shops",
};

function readList(key: string): SavedItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: SavedItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(list));
}

function addItemIfMissing(key: string, item: SavedItem): boolean {
  const existing = readList(key);
  const isSaved = existing.some((entry) => entry.id === item.id);
  if (isSaved) return false;
  writeList(key, [...existing, item]);
  return true;
}

export function addWishlistProduct(item: SavedItem) {
  return addItemIfMissing(STORAGE_KEYS.wishlist, item);
}

export function SavedItemButton({
  listType,
  item,
  className,
  requireAuth = false,
  loginRedirectPath,
}: {
  listType: ListType;
  item: SavedItem;
  className?: string;
  requireAuth?: boolean;
  loginRedirectPath?: string;
}) {
  const key = STORAGE_KEYS[listType];
  const [saved, setSaved] = useState(() => readList(key).some((entry) => entry.id === item.id));

  function toggle() {
    if (requireAuth) {
      const callbackUrl = loginRedirectPath ?? item.href;
      const params = new URLSearchParams({
        callbackUrl,
        wishlistId: item.id,
        wishlistLabel: item.label,
        wishlistHref: item.href,
      });
      window.location.href = `/login?${params.toString()}`;
      return;
    }

    const existing = readList(key);
    const isSaved = existing.some((entry) => entry.id === item.id);

    if (isSaved) {
      writeList(
        key,
        existing.filter((entry) => entry.id !== item.id),
      );
      setSaved(false);
      return;
    }

    writeList(key, [...existing, item]);
    setSaved(true);
  }

  const labels: Record<ListType, { on: string; off: string }> = {
    wishlist: { on: "Remove from Wishlist", off: "Add to Wishlist" },
    "favourite-products": { on: "Unfavourite Product", off: "Favourite Product" },
    "favourite-shops": { on: "Unfavourite Shop", off: "Favourite Shop" },
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        "rounded-md border border-(--accent-terra) px-3 py-1 text-xs text-(--accent-terra) hover:bg-white/50"
      }
    >
      {saved ? labels[listType].on : labels[listType].off}
    </button>
  );
}
