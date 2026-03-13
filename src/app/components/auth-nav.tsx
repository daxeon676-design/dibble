import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/app/components/sign-out-button";
import { CartBadge } from "@/app/components/cart-badge";
import { getSiteConfig } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";

export async function AuthNav() {
  const session = await getServerSession(authOptions);
  const config = await getSiteConfig();
  const isAdmin = session?.user?.role === "ADMIN";
  const isSeller = session?.user?.role === "SELLER";
  const unreadNotifications = session?.user?.id
    ? await prisma.notification.count({
        where: {
          userId: session.user.id,
          readAt: null,
        },
      })
    : 0;

  return (
    <header className="border-b border-(--accent-terra) bg-(--accent-beige)/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3 text-sm text-foreground">
        <Link href="/" className="font-semibold text-(--accent-terra)">
          Dibble
        </Link>

        {/* Searchbar - available to everyone */}
        <form action="/buyer/marketplace" className="min-w-0 flex-1">
          <input
            type="search"
            name="q"
            placeholder="Search products"
            className="w-full rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 text-sm text-foreground placeholder:text-(--accent-terra) focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </form>

        <div className="flex items-center justify-end gap-3">
          {/* Categories - available to everyone */}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-md border border-(--accent-terra) bg-white/60 px-3 py-2 font-medium text-(--accent-terra)">
              Categories
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-(--accent-terra) bg-(--accent-beige) p-1 shadow-lg">
              {config.categories.map((category) => (
                <Link
                  key={category}
                  href={`/buyer/marketplace?category=${encodeURIComponent(category)}`}
                  className="block rounded px-3 py-2 hover:bg-white/60"
                >
                  {category}
                </Link>
              ))}
            </div>
          </details>

          {/* Cart Badge - available to everyone */}
          <CartBadge />

          {/* User Navigation */}
          {session?.user ? (
            <>
              {isAdmin ? (
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-md border border-(--accent-terra) bg-white/60 px-3 py-2 font-medium text-(--accent-terra)">
                    Admin
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-(--accent-terra) bg-(--accent-beige) p-1 shadow-lg">
                    <Link href="/admin" className="block rounded px-3 py-2 hover:bg-white/60">
                      Admin Dashboard
                    </Link>
                    <Link href="/admin/analytics" className="block rounded px-3 py-2 hover:bg-white/60">
                      Admin Analytics
                    </Link>
                    <Link href="/admin/site-settings" className="block rounded px-3 py-2 hover:bg-white/60">
                      Site Settings
                    </Link>
                    <Link href="/admin/ops" className="block rounded px-3 py-2 hover:bg-white/60">
                      Ops Dashboard
                    </Link>
                  </div>
                </details>
              ) : null}

              {isSeller || isAdmin ? (
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-md border border-(--accent-terra) bg-white/60 px-3 py-2 font-medium text-(--accent-terra)">
                    Seller
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-(--accent-terra) bg-(--accent-beige) p-1 shadow-lg">
                    <Link href="/seller" className="block rounded px-3 py-2 hover:bg-white/60">
                      Seller Dashboard
                    </Link>
                    <Link href="/seller/analytics" className="block rounded px-3 py-2 hover:bg-white/60">
                      Analytics
                    </Link>
                  </div>
                </details>
              ) : null}

              <details className="relative">
                <summary className="cursor-pointer list-none rounded-md border border-(--accent-terra) bg-white/60 px-3 py-2 font-medium text-(--accent-terra)">
                  Menu
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-(--accent-terra) bg-(--accent-beige) p-1 shadow-lg">
                  <Link href="/buyer/profile" className="block rounded px-3 py-2 hover:bg-white/60">
                    Account
                  </Link>
                  <Link href="/buyer/orders" className="block rounded px-3 py-2 hover:bg-white/60">
                    Previous Orders
                  </Link>
                  <Link href="/buyer/saved-addresses" className="block rounded px-3 py-2 hover:bg-white/60">
                    Saved Addresses
                  </Link>
                  <Link href="/buyer/notifications" className="block rounded px-3 py-2 hover:bg-white/60">
                    Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}
                  </Link>
                  <Link href="/wishlist" className="block rounded px-3 py-2 hover:bg-white/60">
                    Wishlist
                  </Link>
                  <Link href="/favourites" className="block rounded px-3 py-2 hover:bg-white/60">
                    Favourites
                  </Link>
                  <div className="mt-1 border-t border-(--accent-terra)/30 pt-1">
                    <SignOutButton className="block w-full rounded px-3 py-2 text-left hover:bg-white/60" />
                  </div>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-(--accent-terra)">
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded bg-(--accent-terra) px-2 py-1 font-semibold text-(--accent-beige)"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
