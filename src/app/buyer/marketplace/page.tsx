import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddToCartButton } from "@/app/buyer/marketplace/product-card-actions";
import { SavedItemButton } from "@/app/components/saved-item-button";
import { getProductMetaMap, getSiteConfig } from "@/lib/site-config";
import MarketplaceSearch from "./marketplace-search";

export default async function BuyerMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; seller?: string; category?: string; sort?: string; min?: string; max?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/buyer/marketplace");
  }

  const { q, seller, category, sort, min, max } = await searchParams;
  const query = q?.trim() ?? "";
  const sellerFilter = seller?.trim() ?? "";
  const categoryFilter = category?.trim() ?? "";
  const sortFilter = sort?.trim() ?? "newest";
  const minPounds = min?.trim() ?? "";
  const maxPounds = max?.trim() ?? "";

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

  const meta = await getProductMetaMap();
  let products = productsRaw.filter((product) => {
    const productCategory = meta[product.id]?.category ?? "";
    if (categoryFilter && productCategory !== categoryFilter) {
      return false;
    }

    const pounds = product.priceCents / 100;
    if (minPounds && pounds < Number(minPounds)) return false;
    if (maxPounds && pounds > Number(maxPounds)) return false;
    return true;
  });

  if (sortFilter === "price-asc") {
    products = [...products].sort((a, b) => a.priceCents - b.priceCents);
  } else if (sortFilter === "price-desc") {
    products = [...products].sort((a, b) => b.priceCents - a.priceCents);
  } else if (sortFilter === "name-asc") {
    products = [...products].sort((a, b) => a.title.localeCompare(b.title));
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 text-slate-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Marketplace</h1>
        <div className="flex gap-2">
          <Link href="/buyer/cart" className="rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950">
            View Cart
          </Link>
          <Link href="/buyer/orders" className="rounded-md border border-slate-700 px-4 py-2">
            My Orders
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-8">
        <MarketplaceSearch
          defaultValue={query}
          defaultCategory={categoryFilter}
          defaultSort={sortFilter}
          defaultMin={minPounds}
          defaultMax={maxPounds}
          categories={config.categories}
        />
      </div>

      {/* Result count */}
      <p className="text-sm text-slate-400 mb-4">
        {query ? (
          <>
            Showing <strong className="text-slate-200">{products.length}</strong> result
            {products.length !== 1 && "s"} for &ldquo;{query}&rdquo;
            {" · "}
            <Link href="/buyer/marketplace" className="text-emerald-400 hover:underline">
              Clear
            </Link>
          </>
        ) : (
          <>{products.length} product{products.length !== 1 && "s"} available</>
        )}
      </p>

      {products.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <p className="text-xl mb-2">No products found</p>
          <p className="text-sm">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
              <Link href={`/products/${product.id}`} className="block">
                {product.imageUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrls[0]}
                    alt={product.title}
                    className="mb-3 h-40 w-full rounded-md border border-slate-700 object-cover"
                  />
                ) : null}
                <h2 className="text-lg font-semibold">{product.title}</h2>
              </Link>
              <Link
                href={`/shop/${product.seller.id}`}
                className="text-sm text-emerald-400 hover:underline"
              >
                {product.seller.displayName ?? product.seller.email}
              </Link>
              <p className="mt-2 text-sm text-slate-300">{product.description}</p>
              <p className="mt-3 text-sm text-(--accent-terra)">£{(product.priceCents / 100).toFixed(2)}</p>
              <Link href={`/products/${product.id}`} className="mt-1 block text-xs text-emerald-400 hover:underline">
                View full details
              </Link>
              <AddToCartButton productId={product.id} />
              <div className="mt-2 flex flex-wrap gap-2">
                <SavedItemButton
                  listType="wishlist"
                  item={{
                    id: product.id,
                    label: product.title,
                    href: `/products/${product.id}`,
                  }}
                />
                <SavedItemButton
                  listType="favourite-products"
                  item={{
                    id: product.id,
                    label: product.title,
                    href: `/products/${product.id}`,
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
