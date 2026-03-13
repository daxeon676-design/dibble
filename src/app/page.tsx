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
    seller: { displayName: string | null; email: string };
  }>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <Link href="/buyer/marketplace" className="text-sm text-emerald-300 hover:text-emerald-200">
          Browse all
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="min-w-67.5 rounded-lg transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="h-36 w-full rounded-md border border-dashed border-slate-700 bg-slate-950" />
            <h3 className="mt-3 px-3 text-base font-semibold text-(--accent-terra)">{product.title}</h3>
            <p className="px-3 text-xs text-(--accent-green)">By {product.seller.displayName ?? product.seller.email}</p>
            <div className="mt-2 flex items-center justify-between px-3 pb-3">
              <p className="text-sm text-(--accent-terra)">£{(product.priceCents / 100).toFixed(2)}</p>
              <p className="text-xs text-(--accent-green)">View details</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const config = await getSiteConfig();
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  let newArrivalsWithSellers: Array<ProductWithSeller & { seller: SellerSnippet }> = [];
  let popularProducts: Array<ProductWithSeller & { seller: SellerSnippet }> = [];

  if (!isBuildPhase) {
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
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16">
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-[0.25em] text-(--accent-terra)">
            Dibble Marketplace
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-(--accent-terra) md:text-6xl">
            Dibble, rooted in arts
          </h1>
          <p className="max-w-3xl text-base text-(--accent-green) md:text-lg">{config.homepageTagline}</p>
        </section>

        {/* Removed buyer/seller/admin cards. Only carousels below. */}

        {newArrivalsWithSellers.length > 0 ? <ProductCarousel title="New Arrivals" products={newArrivalsWithSellers} /> : null}
        {popularProducts.length > 0 ? <ProductCarousel title="Popular Picks" products={popularProducts} /> : null}

        {/* Removed create account, sign in, and open buyer dashboard buttons. */}
      </div>
    </main>
  );
}
