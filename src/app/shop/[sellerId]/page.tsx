import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@/generated/prisma/enums";
import { SavedItemButton } from "@/app/components/saved-item-button";
import { FollowShopButton } from "@/app/shop/[sellerId]/follow-shop-button";
import { authOptions } from "@/lib/auth";
import { getSellerShopProfile } from "@/lib/site-config";

export async function generateMetadata({ params }: { params: Promise<{ sellerId: string }> }): Promise<Metadata> {
  const { sellerId } = await params;
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { displayName: true, email: true },
  });
  if (!seller) return { title: "Shop not found" };
  return { title: `${seller.displayName ?? seller.email} – Dibble` };
}

export default async function SellerShopPage({ params }: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await params;
  const session = await getServerSession(authOptions);

  const [seller, shopProfile, followersCount, isFollowing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sellerId, role: "SELLER", status: "ACTIVE" },
      select: {
        id: true,
        displayName: true,
        email: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        sellerApplication: { select: { shopName: true, description: true } },
      },
    }),
    getSellerShopProfile(sellerId),
    prisma.sellerFollow.count({ where: { sellerId } }),
    session?.user?.id
      ? prisma.sellerFollow.findUnique({
          where: {
            sellerId_buyerId: {
              sellerId,
              buyerId: session.user.id,
            },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!seller) notFound();

  const products = await prisma.product.findMany({
    where: { sellerId, status: ProductStatus.ACTIVE, stock: { gt: 0 } },
    orderBy: { createdAt: "desc" },
  });

  const shopName = seller.sellerApplication?.shopName ?? seller.displayName ?? seller.email;
  const shopDesc = shopProfile.description || seller.sellerApplication?.description || seller.bio;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Seller banner */}
      <div className="mb-8 flex items-center gap-5 rounded-xl border border-(--accent-terra)/30 bg-(--accent-beige) p-6">
        {shopProfile.logoUrl || seller.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shopProfile.logoUrl || seller.avatarUrl || ""}
            alt={shopName}
            className="h-20 w-20 rounded-full border-2 border-(--accent-terra)/30 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-(--accent-terra)/20 text-3xl font-bold text-(--accent-terra)">
            {shopName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-(--accent-terra)">{shopName}</h1>
          {shopDesc && <p className="mt-1 max-w-xl text-foreground/80">{shopDesc}</p>}
          {shopProfile.headline ? <p className="mt-2 text-sm text-(--accent-green)">{shopProfile.headline}</p> : null}
          <p className="mt-1 text-xs text-foreground/60">
            Member since {new Date(seller.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          {shopProfile.instagramUrl || shopProfile.tiktokUrl || shopProfile.websiteUrl ? (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {shopProfile.instagramUrl ? <a href={shopProfile.instagramUrl} target="_blank" rel="noreferrer" className="text-(--accent-terra) underline">Instagram</a> : null}
              {shopProfile.tiktokUrl ? <a href={shopProfile.tiktokUrl} target="_blank" rel="noreferrer" className="text-(--accent-terra) underline">TikTok</a> : null}
              {shopProfile.websiteUrl ? <a href={shopProfile.websiteUrl} target="_blank" rel="noreferrer" className="text-(--accent-terra) underline">Website</a> : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SavedItemButton
              listType="favourite-shops"
              item={{ id: seller.id, label: shopName, href: `/shop/${seller.id}` }}
            />
            <FollowShopButton
              sellerId={seller.id}
              initiallyFollowing={Boolean(isFollowing)}
              initialFollowers={followersCount}
            />
          </div>
        </div>
      </div>

      {/* Products */}
      <h2 className="text-xl font-semibold mb-4">
        {products.length} product{products.length !== 1 && "s"} available
      </h2>

      {products.length === 0 ? (
        <p className="text-gray-500">This seller has no active listings right now.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="border rounded-lg overflow-hidden hover:shadow-md transition group"
            >
              {product.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrls[0]}
                  alt={product.title}
                  className="h-40 w-full object-cover group-hover:scale-105 transition"
                />
              ) : (
                <div className="h-40 bg-gray-100 flex items-center justify-center text-3xl">🥦</div>
              )}
              <div className="p-3">
                <h3 className="font-medium">{product.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-(--accent-terra)">
                    £{(product.priceCents / 100).toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-400">View details</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link
          href="/buyer/marketplace"
          className="text-sm text-(--accent-terra) hover:underline"
        >
          ← Back to Marketplace
        </Link>
      </div>
    </main>
  );
}
