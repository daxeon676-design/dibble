"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function MarketplaceSearch({
  defaultValue,
  defaultCategory,
  defaultSort,
  defaultMin,
  defaultMax,
  categories,
}: {
  defaultValue: string;
  defaultCategory: string;
  defaultSort: string;
  defaultMin: string;
  defaultMax: string;
  categories: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [category, setCategory] = useState(defaultCategory);
  const [sort, setSort] = useState(defaultSort);
  const [min, setMin] = useState(defaultMin);
  const [max, setMax] = useState(defaultMax);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }

    if (category) params.set("category", category); else params.delete("category");
    if (sort) params.set("sort", sort); else params.delete("sort");
    if (min) params.set("min", min); else params.delete("min");
    if (max) params.set("max", max); else params.delete("max");

    router.push(`/buyer/marketplace?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-4xl gap-2 md:grid-cols-6">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search products…"
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-500 md:col-span-2"
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="name-asc">Name: A-Z</option>
      </select>
      <input type="number" step="0.01" min="0" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Min £" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
      <input type="number" step="0.01" min="0" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max £" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white md:col-span-6"
      >
        Apply Filters
      </button>
    </form>
  );
}
