import Link from "next/link";
import WishlistClient from "@/app/wishlist/wishlist-client";

export default function WishlistPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-3 text-3xl font-bold text-(--accent-terra)">Wishlist</h1>
      <p className="mb-6 text-sm text-(--accent-green)">Save products you want to revisit, compare, and add to cart faster.</p>
      <WishlistClient />
      <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/buyer/marketplace" className="text-(--accent-terra) underline">Browse Marketplace</Link>
        <Link href="/favourites" className="text-(--accent-terra) underline">View Favourites</Link>
        <Link href="/buyer/cart" className="text-(--accent-terra) underline">Go to Cart</Link>
      </div>
    </main>
  );
}