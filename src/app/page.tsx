import Link from "next/link";

import { ProductStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config";

type SellerSnippet = {
  displayName: string | null;
  email: string;
};

type ProductWithSeller = {
  id: string;
  sellerId: string;
  title: string;
  priceCents: number;
  stock: number;
  imageUrls: string[];
};

function attachSellers(
  products: ProductWithSeller[],
  sellerMap: Map<string, SellerSnippet>,
) {
  return products.map((product) => ({
    ...product,
    seller: sellerMap.get(product.sellerId) ?? { displayName: null, email: "Unknown seller" },
  }));
}

function ProductCarousel({
  title,
  products,
}: {
  title: string;
  products: Array<{
    id: string;
    title: string;
    priceCents: number;
    stock: number;
    imageUrls: string[];
    seller: { displayName: string | null; email: string };
  }>;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <Link href="/buyer/marketplace" className="text-sm text-(--accent-terra) hover:underline">
          Browse all →
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group min-w-50 max-w-50 rounded-xl border border-(--accent-terra)/15 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            {product.imageUrls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrls[0]}
                alt={product.title}
                className="h-40 w-full rounded-t-xl object-cover"
              />
            ) : (
              <div className="h-40 w-full rounded-t-xl bg-(--accent-beige)/60 flex items-center justify-center text-xs text-foreground/40">
                No image
              </div>
            )}
            <div className="p-3">
              <h3 className="line-clamp-2 text-sm font-semibold text-foreground leading-snug">{product.title}</h3>
              <p className="mt-1 text-xs text-(--accent-green) truncate">
                {product.seller.displayName ?? product.seller.email}
              </p>
              <p className="mt-2 text-sm font-bold text-(--accent-terra)">
                £{(product.priceCents / 100).toFixed(2)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  Accessories: "💍",
  "Bath & Beauty": "🧴",
  Books: "📚",
  Clothing: "👗",
  Crafts: "🎨",
  Electronics: "⚡",
  "Food & Drink": "🍞",
  "Home & Living": "🏠",
  Jewellery: "✨",
  "Paper & Party": "🎉",
  Pets: "🐾",
  "Toys & Games": "🧸",
  "Vintage & Collectibles": "🏺",
  Other: "🛍️",
};

export default async function Home() {
  const config = await getSiteConfig();
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  let newArrivalsWithSellers: Array<ProductWithSeller & { seller: SellerSnippet }> = [];
  let popularProducts: Array<ProductWithSeller & { seller: SellerSnippet }> = [];

  if (!isBuildPhase) {
    try {
      const newArrivals = await prisma.product.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          stock: { gt: 0 },
        },
        select: {
          id: true,
          sellerId: true,
          title: true,
          priceCents: true,
          stock: true,
          imageUrls: true,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      });

      const popularOrderItems = await prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 20,
      });

      const popularProductIds = popularOrderItems.map((item) => item.productId);
      const popularProductsRaw =
        popularProductIds.length === 0
          ? []
          : await prisma.product.findMany({
              where: {
                id: { in: popularProductIds },
                status: ProductStatus.ACTIVE,
                stock: { gt: 0 },
              },
              select: {
                id: true,
                sellerId: true,
                title: true,
                priceCents: true,
                stock: true,
                imageUrls: true,
              },
            });

      const sellerIds = [...new Set([...newArrivals, ...popularProductsRaw].map((product) => product.sellerId))];
      const sellers =
        sellerIds.length === 0
          ? []
          : await prisma.user.findMany({
              where: { id: { in: sellerIds } },
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            });

      const sellerMap = new Map(sellers.map((seller) => [seller.id, { displayName: seller.displayName, email: seller.email }]));
      newArrivalsWithSellers = attachSellers(newArrivals, sellerMap);

      const popularProductsRawWithSellers = attachSellers(popularProductsRaw, sellerMap);
      const popularProductsMap = new Map(popularProductsRawWithSellers.map((product) => [product.id, product]));
      popularProducts = popularProductIds
        .map((id) => popularProductsMap.get(id))
        .filter((product): product is ProductWithSeller & { seller: SellerSnippet } => Boolean(product))
        .slice(0, 12);
    } catch (error) {
      console.warn("Home page product feed unavailable, rendering without carousels.", error);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="bg-linear-to-b from-(--accent-beige)/60 to-white px-6 py-16">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-(--accent-terra) sm:text-5xl">
            Discover unique handmade goods
          </h1>
          <p className="text-lg text-foreground/70">{config.homepageTagline}</p>
          <form action="/buyer/marketplace" method="GET" className="relative max-w-xl mx-auto">
            <input
              type="search"
              name="q"
              placeholder="Search for handmade gifts, vintage finds…"
              className="w-full rounded-full border-2 border-(--accent-terra)/40 bg-white py-3.5 pl-5 pr-14 text-base text-foreground shadow-sm focus:border-(--accent-terra) focus:outline-none focus:ring-2 focus:ring-(--accent-terra)/20"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-(--accent-terra) p-2.5 text-white hover:opacity-90 transition-opacity"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
          <p className="text-sm text-foreground/50">
            <Link href="/buyer/marketplace" className="text-(--accent-terra) hover:underline font-medium">
              Browse all products
            </Link>
            {" · "}
            <Link href="/register" className="text-(--accent-terra) hover:underline font-medium">
              Start selling
            </Link>
          </p>
        </div>
      </section>

      {/* Category pills */}
      <section className="border-y border-(--accent-terra)/10 bg-white py-5 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-2 justify-center">
            {config.categories.map((category) => (
              <Link
                key={category}
                href={`/buyer/marketplace?category=${encodeURIComponent(category)}`}
                className="flex items-center gap-1.5 rounded-full border border-(--accent-terra)/30 bg-(--accent-beige)/40 px-4 py-2 text-sm font-medium text-foreground hover:bg-(--accent-terra) hover:text-white hover:border-(--accent-terra) transition-colors"
              >
                <span>{CATEGORY_ICONS[category] ?? "🛍️"}</span>
                {category}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Carousels */}
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-6 py-12">
        {newArrivalsWithSellers.length > 0 ? (
          <ProductCarousel title="New Arrivals" products={newArrivalsWithSellers} />
        ) : null}
        {popularProducts.length > 0 ? (
          <ProductCarousel title="Popular Picks" products={popularProducts} />
        ) : null}
        {newArrivalsWithSellers.length === 0 && popularProducts.length === 0 && !isBuildPhase ? (
          <div className="py-20 text-center space-y-4">
            <p className="text-4xl">🛍️</p>
            <p className="text-xl font-semibold text-foreground/70">No products listed yet</p>
            <p className="text-sm text-foreground/50">Be the first to sell on Dibble.</p>
            <Link
              href="/buyer/seller-application"
              className="inline-block mt-2 rounded-full bg-(--accent-terra) px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Apply to Sell
            </Link>
          </div>
        ) : null}
      </div>

      {/* Value props */}
      <section className="bg-(--accent-beige)/30 border-t border-(--accent-terra)/10 py-14 px-6">
        <div className="mx-auto max-w-5xl grid gap-8 sm:grid-cols-3 text-center">
          <div className="space-y-2">
            <div className="text-3xl">🎁</div>
            <h3 className="font-semibold text-foreground">Unique & Handmade</h3>
            <p className="text-sm text-foreground/60">Every item is crafted with care by independent sellers.</p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">🚚</div>
            <h3 className="font-semibold text-foreground">Flexible Delivery</h3>
            <p className="text-sm text-foreground/60">Multiple shipping options to suit your needs.</p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">🤝</div>
            <h3 className="font-semibold text-foreground">Support Small Sellers</h3>
            <p className="text-sm text-foreground/60">Your purchase directly supports independent creators.</p>
          </div>
        </div>
      </section>
    </main>
  );
}


