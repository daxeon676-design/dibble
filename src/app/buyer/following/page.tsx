import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BuyerFollowingFeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/buyer/following");
  }

  if (session.user.role !== Role.BUYER && session.user.role !== Role.ADMIN) {
    redirect("/seller");
  }

  const follows = await prisma.sellerFollow.findMany({
    where: { buyerId: session.user.id },
    select: {
      sellerId: true,
      seller: {
        select: { displayName: true, email: true },
      },
    },
  });

  const followedSellerIds = follows.map((follow) => follow.sellerId);
  const products =
    followedSellerIds.length === 0
      ? []
      : await prisma.product.findMany({
          where: {
            sellerId: { in: followedSellerIds },
            status: ProductStatus.ACTIVE,
            stock: { gt: 0 },
          },
          orderBy: { createdAt: "desc" },
          take: 36,
          select: {
            id: true,
            title: true,
            imageUrls: true,
            priceCents: true,
            createdAt: true,
            sellerId: true,
          },
        });

  const sellerNameById = new Map(
    follows.map((follow) => [follow.sellerId, follow.seller.displayName ?? follow.seller.email]),
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-(--accent-terra)">Following Feed</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Fresh listings from shops you follow.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/buyer/marketplace" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm text-(--accent-terra)">
            Marketplace
          </Link>
          <Link href="/buyer" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm text-(--accent-terra)">
            Buyer Dashboard
          </Link>
        </div>
      </div>

      {followedSellerIds.length === 0 ? (
        <section className="rounded-xl border border-(--accent-terra)/30 bg-white p-8 text-center">
          <p className="text-lg font-medium text-(--accent-terra)">You are not following any shops yet.</p>
          <p className="mt-1 text-sm text-foreground/70">Follow a seller from their shop page to build your personalized feed.</p>
        </section>
      ) : products.length === 0 ? (
        <section className="rounded-xl border border-(--accent-terra)/30 bg-white p-8 text-center">
          <p className="text-lg font-medium text-(--accent-terra)">No new active listings right now.</p>
          <p className="mt-1 text-sm text-foreground/70">Check back soon for new drops from your followed shops.</p>
        </section>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-xl border border-(--accent-terra)/25 bg-white">
              <Link href={`/products/${product.id}`}>
                {product.imageUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrls[0]} alt={product.title} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-(--accent-beige)/50 text-sm text-foreground/50">
                    No image
                  </div>
                )}
              </Link>
              <div className="space-y-2 p-4">
                <Link href={`/products/${product.id}`} className="line-clamp-2 text-sm font-semibold text-foreground hover:underline">
                  {product.title}
                </Link>
                <p className="text-xs text-foreground/60">
                  by {sellerNameById.get(product.sellerId) ?? "Seller"}
                </p>
                <p className="text-xs text-foreground/50">Added {product.createdAt.toLocaleDateString("en-GB")}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-(--accent-terra)">£{(product.priceCents / 100).toFixed(2)}</span>
                  <Link href={`/shop/${product.sellerId}`} className="text-xs text-(--accent-terra) hover:underline">
                    Visit shop
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
