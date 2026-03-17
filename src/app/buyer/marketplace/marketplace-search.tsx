"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

const RECENT_SEARCH_KEY = "dibble:recent-marketplace-searches";

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(searches: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(searches.slice(0, 6)));
}

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
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const quickSuggestions = useMemo(() => {
    if (!value.trim()) return categories.slice(0, 6);
    const normalized = value.trim().toLowerCase();
    return categories.filter((item) => item.toLowerCase().includes(normalized)).slice(0, 6);
  }, [categories, value]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = value.trim();

    if (cleaned) {
      const next = [
        cleaned,
        ...recentSearches.filter((item) => item.toLowerCase() !== cleaned.toLowerCase()),
      ].slice(0, 6);
      setRecentSearches(next);
      writeRecentSearches(next);
    }

    const params = new URLSearchParams(searchParams.toString());
    if (cleaned) {
      params.set("q", cleaned);
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
    <form onSubmit={handleSubmit} className="grid max-w-5xl gap-2 md:grid-cols-6">
      <div className="relative md:col-span-2">
        <input
          type="search"
          value={value}
          onFocus={() => setSuggestionsOpen(true)}
          onBlur={() => setTimeout(() => setSuggestionsOpen(false), 120)}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search products..."
          className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-4 py-2 text-sm text-foreground placeholder:text-foreground/50"
        />

        {suggestionsOpen && (recentSearches.length > 0 || quickSuggestions.length > 0) ? (
          <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-(--accent-terra)/20 bg-white p-3 shadow-lg">
            {recentSearches.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Recent</p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onMouseDown={() => setValue(item)}
                      className="rounded-full border border-(--accent-terra)/30 bg-(--accent-beige)/30 px-3 py-1 text-xs text-foreground"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {quickSuggestions.length > 0 ? (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Categories</p>
                <div className="flex flex-wrap gap-2">
                  {quickSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onMouseDown={() => setCategory(item)}
                      className="rounded-full border border-(--accent-terra)/30 px-3 py-1 text-xs text-(--accent-terra)"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-(--accent-terra)/30 bg-white px-3 py-2 text-sm text-foreground">
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-(--accent-terra)/30 bg-white px-3 py-2 text-sm text-foreground">
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="name-asc">Name: A-Z</option>
      </select>
      <input type="number" step="0.01" min="0" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Min £" className="rounded-md border border-(--accent-terra)/30 bg-white px-3 py-2 text-sm text-foreground" />
      <input type="number" step="0.01" min="0" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max £" className="rounded-md border border-(--accent-terra)/30 bg-white px-3 py-2 text-sm text-foreground" />
      <button
        type="submit"
        className="rounded-md bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-white md:col-span-6"
      >
        Apply Filters
      </button>
    </form>
  );
}
