"use client";

import Link from "next/link";
import { useState } from "react";

type SavedItem = { id: string; label: string; href: string };

function readItems(key: string): SavedItem[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ItemList({ title, items }: { title: string; items: SavedItem[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-(--accent-terra)">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded border border-(--accent-terra)/40 bg-(--accent-beige) p-3 text-sm text-foreground/70">
          None saved yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded border border-(--accent-terra)/40 bg-(--accent-beige) p-3">
              <Link href={item.href} className="font-medium text-(--accent-terra) underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function FavouritesClient() {
  const [products] = useState<SavedItem[]>(() => readItems("dibble:favourite-products"));
  const [shops] = useState<SavedItem[]>(() => readItems("dibble:favourite-shops"));

  return (
    <div className="space-y-6">
      <ItemList title="Favourite Shops" items={shops} />
      <ItemList title="Favourite Products" items={products} />
    </div>
  );
}
