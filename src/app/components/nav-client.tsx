"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { CartBadge } from "@/app/components/cart-badge";
import { SignOutButton } from "@/app/components/sign-out-button";

type NavUser = {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type Props = {
  user: NavUser | null;
  unreadCount: number;
  categories: string[];
};

type CategoryGroup = {
  title: string;
  items: string[];
};

const RECENT_SEARCH_KEY = "dibble:recent-searches";

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

function groupCategories(categories: string[]): CategoryGroup[] {
  const startsWith = (letters: string[]) =>
    categories.filter((item) => letters.some((letter) => item.toLowerCase().startsWith(letter)));

  return [
    { title: "Handmade", items: startsWith(["a", "b", "c", "h", "j", "p"]) },
    { title: "Style", items: startsWith(["f", "v", "t"]) },
    { title: "Home", items: startsWith(["e", "o"]) },
    { title: "Gifting", items: startsWith(["g", "k"]) },
  ].filter((group) => group.items.length > 0);
}

function Dropdown({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function closeIfOutside(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const target = e.target as Node;
    if (!ref.current.contains(target)) {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1 rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 font-medium text-(--accent-terra) hover:bg-white transition-colors"
      >
        {label}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 min-w-52 rounded-xl border border-(--accent-terra)/30 bg-white shadow-xl ring-1 ring-black/5"
          onClick={() => setOpen(false)}
          onMouseDown={closeIfOutside}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-foreground hover:bg-(--accent-beige)/60 transition-colors"
    >
      {children}
    </Link>
  );
}

function DropdownDivider() {
  return <div className="my-1 border-t border-(--accent-terra)/20" />;
}

function AccountMenu({ user, unreadCount }: { user: NavUser; unreadCount: number }) {
  const isAdmin = user.role === "ADMIN";
  const isSeller = user.role === "SELLER" || isAdmin;

  return (
    <>
      {isAdmin && (
        <Dropdown label="Admin">
          <div className="p-1">
            <DropdownLink href="/admin">Admin Dashboard</DropdownLink>
            <DropdownLink href="/admin/analytics">Analytics</DropdownLink>
            <DropdownLink href="/admin/payouts">Payout Queue</DropdownLink>
            <DropdownLink href="/admin/payout-profiles">Payout Profiles</DropdownLink>
            <DropdownLink href="/admin/payout-reconciliation">Payout Reconciliation</DropdownLink>
            <DropdownLink href="/admin/disputes">Disputes</DropdownLink>
            <DropdownLink href="/admin/users-support">Users &amp; Support</DropdownLink>
            <DropdownLink href="/admin/orders">All Orders</DropdownLink>
            <DropdownLink href="/admin/site-settings">Site Settings</DropdownLink>
            <DropdownLink href="/admin/legal-pages">Legal Pages</DropdownLink>
            <DropdownLink href="/admin/security">Security &amp; Audit</DropdownLink>
            <DropdownLink href="/admin/launch-config">Launch Config</DropdownLink>
            <DropdownLink href="/admin/ops">Ops Dashboard</DropdownLink>
          </div>
        </Dropdown>
      )}

      {isSeller && (
        <Dropdown label="Seller">
          <div className="p-1">
            <DropdownLink href="/seller">Seller Dashboard</DropdownLink>
            <DropdownLink href="/seller/products">My Products</DropdownLink>
            <DropdownLink href="/seller/orders">Seller Orders</DropdownLink>
            <DropdownLink href="/seller/analytics">Analytics</DropdownLink>
            <DropdownDivider />
            <DropdownLink href="/settings">Shop Settings</DropdownLink>
            <DropdownLink href="/seller/delivery-options">Delivery Options</DropdownLink>
          </div>
        </Dropdown>
      )}

      <Dropdown label={user.name ?? user.email ?? "Account"}>
        <div className="p-1">
          <DropdownLink href="/buyer/profile">My Profile</DropdownLink>
          <DropdownLink href="/buyer/orders">My Orders</DropdownLink>
          <DropdownLink href="/buyer/saved-addresses">Saved Addresses</DropdownLink>
          <DropdownLink href="/wishlist">Wishlist</DropdownLink>
          <DropdownLink href="/favourites">Favourites</DropdownLink>
          <DropdownLink href="/buyer/messages">Messages</DropdownLink>
          <DropdownLink href="/buyer/notifications">
            Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </DropdownLink>
          {!isSeller && (
            <>
              <DropdownDivider />
              <DropdownLink href="/buyer/seller-application">Become a Seller</DropdownLink>
            </>
          )}
          <DropdownDivider />
          <div className="px-1">
            <SignOutButton className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-(--accent-beige)/60 transition-colors" />
          </div>
        </div>
      </Dropdown>
    </>
  );
}

export function NavClient({ user, unreadCount, categories }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());

  const groupedCategories = useMemo(() => groupCategories(categories), [categories]);

  const suggestedCategories = useMemo(() => {
    if (!query.trim()) return categories.slice(0, 6);
    const normalized = query.trim().toLowerCase();
    return categories.filter((item) => item.toLowerCase().includes(normalized)).slice(0, 6);
  }, [categories, query]);

  function handleSearchSubmit() {
    const cleaned = query.trim();
    if (!cleaned) return;
    const next = [cleaned, ...recentSearches.filter((item) => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 6);
    setRecentSearches(next);
    writeRecentSearches(next);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-(--accent-terra)/40 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-(--accent-terra)/40 text-(--accent-terra) md:hidden"
          onClick={() => setDrawerOpen((value) => !value)}
          aria-label="Open navigation"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm14 4H3v2h14v-2z" />
          </svg>
        </button>

        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-(--accent-terra)">
          Dibble
        </Link>

        <form
          action="/buyer/marketplace"
          method="GET"
          className="relative min-w-0 flex-1"
          onSubmit={handleSearchSubmit}
        >
          <div className="relative">
            <input
              type="search"
              name="q"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for anything"
              className="w-full rounded-full border border-(--accent-terra)/50 bg-(--accent-beige)/30 py-2 pl-4 pr-10 text-sm text-foreground placeholder:text-foreground/50 focus:border-(--accent-terra) focus:bg-white focus:outline-none focus:ring-2 focus:ring-(--accent-terra)/20 transition"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-(--accent-terra) hover:bg-(--accent-terra) hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {searchOpen && (recentSearches.length > 0 || suggestedCategories.length > 0) ? (
            <div className="absolute left-0 right-0 z-50 mt-2 rounded-xl border border-(--accent-terra)/25 bg-white p-3 shadow-xl">
              {recentSearches.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Recent</p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((item) => (
                      <Link
                        key={item}
                        href={`/buyer/marketplace?q=${encodeURIComponent(item)}`}
                        onClick={() => setQuery(item)}
                        className="rounded-full border border-(--accent-terra)/30 bg-(--accent-beige)/25 px-3 py-1 text-xs text-foreground hover:bg-(--accent-beige)/45"
                      >
                        {item}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {suggestedCategories.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedCategories.map((item) => (
                      <Link
                        key={item}
                        href={`/buyer/marketplace?category=${encodeURIComponent(item)}`}
                        className="rounded-full border border-(--accent-terra)/30 px-3 py-1 text-xs text-(--accent-terra) hover:bg-(--accent-terra) hover:text-white"
                      >
                        {item}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>

        <div className="hidden items-center gap-2 md:flex">
          <Dropdown label="Categories">
            <div className="grid min-w-105 grid-cols-2 gap-4 p-4">
              {groupedCategories.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">{group.title}</p>
                  <div className="space-y-1">
                    {group.items.map((category) => (
                      <DropdownLink key={category} href={`/buyer/marketplace?category=${encodeURIComponent(category)}`}>
                        {category}
                      </DropdownLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Dropdown>

          <CartBadge />

          {user ? (
            <AccountMenu user={user} unreadCount={unreadCount} />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-(--accent-terra) hover:bg-(--accent-beige)/50 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="hidden border-t border-(--accent-terra)/10 bg-(--accent-beige)/20 md:block">
        <div className="mx-auto flex max-w-7xl gap-0 overflow-x-auto px-4 sm:px-6">
          {categories.slice(0, 12).map((category) => (
            <Link
              key={category}
              href={`/buyer/marketplace?category=${encodeURIComponent(category)}`}
              className="shrink-0 whitespace-nowrap px-4 py-2 text-xs font-medium text-foreground/70 hover:text-(--accent-terra) hover:bg-white/60 transition-colors"
            >
              {category}
            </Link>
          ))}
        </div>
      </div>

      {drawerOpen ? (
        <div className="border-t border-(--accent-terra)/10 bg-white md:hidden">
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-2">
              <Link href="/buyer/marketplace" onClick={() => setDrawerOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-(--accent-beige)/40">
                Marketplace Home
              </Link>
              <Link href="/wishlist" onClick={() => setDrawerOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-(--accent-beige)/40">
                Wishlist
              </Link>
              <Link href="/favourites" onClick={() => setDrawerOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-(--accent-beige)/40">
                Favourites
              </Link>
              {user ? (
                <Link href="/buyer/profile" onClick={() => setDrawerOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-(--accent-beige)/40">
                  Account
                </Link>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Top categories</p>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 10).map((category) => (
                  <Link
                    key={category}
                    href={`/buyer/marketplace?category=${encodeURIComponent(category)}`}
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-full border border-(--accent-terra)/30 px-3 py-1 text-xs text-(--accent-terra)"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CartBadge />
              {!user ? (
                <>
                  <Link href="/login" onClick={() => setDrawerOpen(false)} className="rounded-md px-3 py-2 text-sm text-(--accent-terra) hover:bg-(--accent-beige)/50">
                    Sign In
                  </Link>
                  <Link href="/register" onClick={() => setDrawerOpen(false)} className="rounded-full bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-white">
                    Register
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
