import Link from "next/link";
import WishlistClient from "@/app/wishlist/wishlist-client";

export default function WishlistPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-(--accent-terra)">Wishlist</h1>
      <p className="mb-4 text-sm text-(--accent-green)">Save products you want to revisit or buy later.</p>
      <WishlistClient />
      <div className="mt-6 text-center">
        <Link href="/buyer/marketplace" className="text-(--accent-terra) underline">Browse Marketplace</Link>
      </div>
    </main>
  );
}