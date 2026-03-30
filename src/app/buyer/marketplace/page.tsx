import { getServerSession } from "next-auth";
import Link from "next/link";

import { ProductStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddToCartButton } from "@/app/buyer/marketplace/product-card-actions";
import { SavedItemButton } from "@/app/components/saved-item-button";
import { getProductCategories, getProductMetaMap, getSellerShopProfiles, getSiteConfig } from "@/lib/site-config";
import MarketplaceSearch from "./marketplace-search";

export default async function BuyerMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; seller?: string; category?: string; sort?: string; min?: string; max?: string; local?: string; radius?: string }>;
}) {
  const session = await getServerSession(authOptions);

  const { q, seller, category, sort, min, max, local, radius } = await searchParams;
  const query = q?.trim() ?? "";
  const sellerFilter = seller?.trim() ?? "";
  const categoryFilter = category?.trim() ?? "";
  const sortFilter = sort?.trim() ?? "newest";
  const minPounds = min?.trim() ?? "";
  const maxPounds = max?.trim() ?? "";
  const localFilter = local?.trim() ?? "";
  const radiusFilter = Math.max(0, Number(radius?.trim() ?? "0"));

  const config = await getSiteConfig();

  const productsRaw = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      stock: { gt: 0 },
      ...(query && {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      }),
      ...(sellerFilter && { sellerId: sellerFilter }),
    },
    include: {
      seller: {
        select: { id: true, displayName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const [meta, sellerProfiles] = await Promise.all([
    getProductMetaMap(),
    getSellerShopProfiles(),
  ]);
  let products = productsRaw.filter((product) => {
    const productCategories = getProductCategories(meta[product.id]);
    if (categoryFilter && !productCategories.includes(categoryFilter)) {
      return false;
    }

    const pounds = product.priceCents / 100;
    if (minPounds && pounds < Number(minPounds)) return false;
    if (maxPounds && pounds > Number(maxPounds)) return false;

    if (localFilter) {
      const profile = sellerProfiles[product.seller.id] ?? {};
      const sellerAllowsLocal = Boolean(profile.localDiscoveryEnabled);
      const sellerLocation = (profile.localDiscoveryLocation ?? "").toLowerCase();
      const localMatch = sellerLocation.includes(localFilter.toLowerCase());
      const sellerRadius = Number(profile.localDiscoveryRadiusMiles ?? 0);
      if (!sellerAllowsLocal || !localMatch || (radiusFilter > 0 && sellerRadius < radiusFilter)) {
        return false;
      }
    }

    return true;
  });

  if (sortFilter === "price-asc") {
    products = [...products].sort((a, b) => a.priceCents - b.priceCents);
  } else if (sortFilter === "price-desc") {
    products = [...products].sort((a, b) => b.priceCents - a.priceCents);
  } else if (sortFilter === "name-asc") {
    products = [...products].sort((a, b) => a.title.localeCompare(b.title));
  }

  const buildCategoryHref = (nextCategory: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (nextCategory) params.set("category", nextCategory);
    if (sortFilter && sortFilter !== "newest") params.set("sort", sortFilter);
    if (minPounds) params.set("min", minPounds);
    if (maxPounds) params.set("max", maxPounds);
    if (localFilter) params.set("local", localFilter);
    if (radiusFilter > 0) params.set("radius", String(radiusFilter));
    const qs = params.toString();
    return qs ? `/buyer/marketplace?${qs}` : "/buyer/marketplace";
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-foreground">Marketplace</h1>
        {session?.user && (
          <div className="flex gap-2">
            <Link href="/buyer/cart" className="rounded-full bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              View Cart
            </Link>
            <Link href="/buyer/orders" className="rounded-full border border-(--accent-terra)/40 px-4 py-2 text-sm text-(--accent-terra) hover:bg-(--accent-beige)/40 transition-colors">
              My Orders
            </Link>
          </div>
        )}
      </div>

  {/* Search bar */}
      <div className="mb-8">
        <MarketplaceSearch
          defaultValue={query}
          defaultCategory={categoryFilter}
          defaultSort={sortFilter}
          defaultMin={minPounds}
          defaultMax={maxPounds}
          defaultLocal={localFilter}
          defaultRadius={radius?.trim() ?? ""}
          categories={config.categories}
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href={buildCategoryHref("")}
          className={`rounded-full border px-3 py-1 text-xs ${categoryFilter ? "border-(--accent-terra)/30 text-(--accent-terra)" : "border-(--accent-terra) bg-(--accent-terra) text-white"}`}
        >
          All
        </Link>
        {config.categories.map((cat) => (
          <Link
            key={cat}
            href={buildCategoryHref(cat)}
            className={`rounded-full border px-3 py-1 text-xs ${categoryFilter === cat ? "border-(--accent-terra) bg-(--accent-terra) text-white" : "border-(--accent-terra)/30 text-(--accent-terra) hover:bg-(--accent-beige)/40"}`}
          >
            {cat}
          </Link>
        ))}
      </div>

      {/* Result count */}
      <p className="text-sm text-foreground/60 mb-4">
        {query ? (
          <>
            Showing <strong className="text-foreground">{products.length}</strong> result
            {products.length !== 1 && "s"} for &ldquo;{query}&rdquo;
            {" · "}
            <Link href="/buyer/marketplace" className="text-(--accent-terra) hover:underline">
              Clear
            </Link>
          </>
        ) : (
          <>{products.length} product{products.length !== 1 && "s"} available</>
        )}
      </p>

      {products.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-5xl">🔍</p>
          <p className="text-xl font-semibold text-foreground/70">No products found</p>
          <p className="text-sm text-foreground/50">Try a different search term or browse categories from the menu.</p>
          <Link href="/buyer/marketplace" className="inline-block mt-2 text-sm text-(--accent-terra) hover:underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const categoriesForCard = getProductCategories(meta[product.id]);
            return (
              <article key={product.id} className="group rounded-xl border border-(--accent-terra)/15 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <Link href={`/products/${product.id}`} className="block">
                  {product.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrls[0]}
                      alt={product.title}
                      className="h-44 w-full object-cover group-hover:opacity-95 transition-opacity"
                    />
                  ) : (
                    <div className="h-44 w-full bg-(--accent-beige)/40 flex items-center justify-center text-sm text-foreground/40">
                      No image
                    </div>
                  )}
                </Link>
                <div className="p-4 space-y-2">
                  <Link href={`/products/${product.id}`} className="block">
                    <h2 className="font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-(--accent-terra) transition-colors">
                      {product.title}
                    </h2>
                  </Link>
                  {categoriesForCard.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {categoriesForCard.slice(0, 3).map((cat) => (
                        <span key={`${product.id}-${cat}`} className="rounded-full border border-(--accent-terra)/25 bg-(--accent-beige)/35 px-2 py-0.5 text-[10px] font-medium text-(--accent-terra)">
                          {cat}
                        </span>
                      ))}
                      {categoriesForCard.length > 3 ? (
                        <span className="rounded-full border border-(--accent-terra)/25 px-2 py-0.5 text-[10px] font-medium text-foreground/60">
                          +{categoriesForCard.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <Link href={`/shop/${product.seller.id}`} className="text-xs text-(--accent-green) hover:underline block truncate">
                    {product.seller.displayName ?? product.seller.email}
                  </Link>
                  <p className="text-sm font-bold text-(--accent-terra)">£{(product.priceCents / 100).toFixed(2)}</p>
                  {session?.user ? (
                    <>
                      <AddToCartButton productId={product.id} />
                      <div className="flex gap-2 flex-wrap pt-1">
                        <SavedItemButton
                          listType="wishlist"
                          item={{ id: product.id, label: product.title, href: `/products/${product.id}` }}
                        />
                        <SavedItemButton
                          listType="favourite-products"
                          item={{ id: product.id, label: product.title, href: `/products/${product.id}` }}
                        />
                      </div>
                    </>
                  ) : (
                    <Link
                      href={`/login?callbackUrl=/products/${product.id}`}
                      className="mt-1 inline-block rounded-full border border-(--accent-terra) px-3 py-1 text-xs font-medium text-(--accent-terra) hover:bg-(--accent-terra) hover:text-white transition-colors"
                    >
                      Sign in to buy
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
