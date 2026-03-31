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

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "https://dibblemarketplace.com";

export async function generateMetadata({ params }: { params: Promise<{ sellerId: string }> }): Promise<Metadata> {
  const { sellerId } = await params;
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: {
      displayName: true,
      email: true,
      bio: true,
      sellerApplication: { select: { shopName: true, description: true } },
    },
  });
  if (!seller) return { title: "Shop not found" };
  const shopName = seller.sellerApplication?.shopName ?? seller.displayName ?? seller.email;
  const description =
    seller.sellerApplication?.description ??
    seller.bio ??
    `Browse handmade and local products from ${shopName} on Dibble.`;
  const shortDescription = description.slice(0, 160);
  const url = `${baseUrl}/shop/${sellerId}`;

  return {
    title: `${shopName} – Dibble`,
    description: shortDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: `${shopName} – Dibble`,
      description: shortDescription,
    },
    twitter: {
      card: "summary",
      title: `${shopName} – Dibble`,
      description: shortDescription,
    },
  };
}

export default async function SellerShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ tab?: string; sort?: string }>;
}) {
  const { sellerId } = await params;
  const { tab, sort } = await searchParams;
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
        sellerApplication: { select: { shopName: true, description: true, businessAddress: true, businessType: true } },
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

  const newArrivals = [...products]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);
  const underTwentyFive = products.filter((product) => product.priceCents <= 2500);

  const selectedTab = tab === "new" || tab === "under-25" ? tab : "all";
  const selectedSort = sort === "price-asc" || sort === "price-desc" || sort === "name-asc" ? sort : "newest";

  const tabProducts =
    selectedTab === "new"
      ? newArrivals
      : selectedTab === "under-25"
        ? underTwentyFive
        : products;

  const visibleProducts =
    selectedSort === "price-asc"
      ? [...tabProducts].sort((a, b) => a.priceCents - b.priceCents)
      : selectedSort === "price-desc"
        ? [...tabProducts].sort((a, b) => b.priceCents - a.priceCents)
        : selectedSort === "name-asc"
          ? [...tabProducts].sort((a, b) => a.title.localeCompare(b.title))
          : [...tabProducts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const tabCounts = {
    all: products.length,
    new: newArrivals.length,
    under: underTwentyFive.length,
  };

  const buildShopUrl = (nextTab: string, nextSort: string) => {
    const query = new URLSearchParams();
    if (nextTab !== "all") query.set("tab", nextTab);
    if (nextSort !== "newest") query.set("sort", nextSort);
    const qs = query.toString();
    return qs ? `/shop/${sellerId}?${qs}` : `/shop/${sellerId}`;
  };

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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-(--accent-terra)">{shopName}</h1>
            {shopProfile.verified ? (
              <span className="rounded-full border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Verified seller
              </span>
            ) : null}
          </div>
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
            <a
              href={`mailto:${seller.email}?subject=${encodeURIComponent(`Question about ${shopName}`)}`}
              className="rounded-md border border-(--accent-terra)/40 px-3 py-1 text-xs text-(--accent-terra) hover:bg-(--accent-beige)/40"
            >
              Message Seller
            </a>
          </div>
          {seller.sellerApplication?.businessAddress ? (
            <p className="mt-3 text-xs text-foreground/50">
              Trading address: {seller.sellerApplication.businessAddress}
            </p>
          ) : null}
        </div>
      </div>

      {/* Products */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          {visibleProducts.length} product{visibleProducts.length !== 1 && "s"} in this section
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href={buildShopUrl("all", selectedSort)}
            className={`rounded-full border px-3 py-1 ${selectedTab === "all" ? "border-(--accent-terra) bg-(--accent-terra) text-white" : "border-(--accent-terra)/30 bg-white text-foreground"}`}
          >
            All Items ({tabCounts.all})
          </Link>
          <Link
            href={buildShopUrl("new", selectedSort)}
            className={`rounded-full border px-3 py-1 ${selectedTab === "new" ? "border-(--accent-terra) bg-(--accent-terra) text-white" : "border-(--accent-terra)/30 bg-white text-foreground"}`}
          >
            New Arrivals ({tabCounts.new})
          </Link>
          <Link
            href={buildShopUrl("under-25", selectedSort)}
            className={`rounded-full border px-3 py-1 ${selectedTab === "under-25" ? "border-(--accent-terra) bg-(--accent-terra) text-white" : "border-(--accent-terra)/30 bg-white text-foreground"}`}
          >
            Under £25 ({tabCounts.under})
          </Link>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 text-xs">
        <Link href={buildShopUrl(selectedTab, "newest")} className={`rounded-full border px-3 py-1 ${selectedSort === "newest" ? "border-(--accent-terra) bg-(--accent-beige)" : "border-(--accent-terra)/20"}`}>
          Newest
        </Link>
        <Link href={buildShopUrl(selectedTab, "price-asc")} className={`rounded-full border px-3 py-1 ${selectedSort === "price-asc" ? "border-(--accent-terra) bg-(--accent-beige)" : "border-(--accent-terra)/20"}`}>
          Price Low to High
        </Link>
        <Link href={buildShopUrl(selectedTab, "price-desc")} className={`rounded-full border px-3 py-1 ${selectedSort === "price-desc" ? "border-(--accent-terra) bg-(--accent-beige)" : "border-(--accent-terra)/20"}`}>
          Price High to Low
        </Link>
        <Link href={buildShopUrl(selectedTab, "name-asc")} className={`rounded-full border px-3 py-1 ${selectedSort === "name-asc" ? "border-(--accent-terra) bg-(--accent-beige)" : "border-(--accent-terra)/20"}`}>
          Name A-Z
        </Link>
      </div>

      {visibleProducts.length === 0 ? (
        <p className="text-gray-500">This seller has no active listings right now.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProducts.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group overflow-hidden rounded-xl border border-(--accent-terra)/20 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {product.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrls[0]}
                  alt={product.title}
                  className="h-44 w-full object-cover transition group-hover:opacity-95"
                />
              ) : (
                <div className="flex h-44 items-center justify-center bg-(--accent-beige)/40 text-sm text-foreground/40">No image</div>
              )}
              <div className="space-y-2 p-4">
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{product.title}</h3>
                <p className="line-clamp-2 text-xs text-foreground/60">{product.description}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-(--accent-terra)">
                    £{(product.priceCents / 100).toFixed(2)}
                  </span>
                  <span className="text-xs text-foreground/45">View details</span>
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
