import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";

import { ProductDetailActions } from "@/app/products/[id]/product-detail-actions";
import { ReviewForm } from "@/app/products/[id]/review-form";
import { SavedItemButton } from "@/app/components/saved-item-button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductCategories, getProductMetaMap, getProductVariants, getSellerShopProfile } from "@/lib/site-config";
import { ProductStatus, Role } from "@/generated/prisma/enums";
import { generateProductSchema, generateBreadcrumbSchema } from "@/lib/seo-utils";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dibble.farm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          displayName: true,
          email: true,
          sellerApplication: { select: { shopName: true } },
        },
      },
    },
  });

  if (!product) {
    return { title: "Product not found" };
  }

  const reviews = await prisma.review.findMany({ where: { productId: id } });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const rating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : undefined;

  const description = product.description.substring(0, 160);
  const imageUrl = product.imageUrls[0] || `${baseUrl}/og-image.png`;
  const sellerName = product.seller.sellerApplication?.shopName ?? product.seller.displayName ?? product.seller.email;

  return {
    title: `${product.title} | Buy Fresh Produce on Dibble`,
    description,
    keywords: `${product.title}, fresh produce, ${sellerName}, local food, sustainable shopping`,
    openGraph: {
      type: "website",
      url: `${baseUrl}/products/${id}`,
      title: product.title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: product.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const [product, metaMap, reviews] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            email: true,
            sellerApplication: { select: { shopName: true } },
          },
        },
      },
    }),
    getProductMetaMap(),
    prisma.review.findMany({
      where: { productId: id },
      include: {
        buyer: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!product) {
    notFound();
  }

  const canPreviewHidden = session?.user?.id === product.sellerId || session?.user?.role === Role.ADMIN;
  if (product.status !== ProductStatus.ACTIVE && !canPreviewHidden) {
    notFound();
  }

  const meta = metaMap[id] ?? {};
  const categories = getProductCategories(meta);
  const variants = getProductVariants(meta);
  const sellerShopProfile = await getSellerShopProfile(product.seller.id);
  const reviewAverage = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : null;

  // Generate structured data
  const sellerName = product.seller.sellerApplication?.shopName ?? product.seller.displayName ?? product.seller.email;
  const productSchema = generateProductSchema(
    {
      id: product.id,
      title: product.title,
      description: product.description,
      priceCents: product.priceCents,
      imageUrls: product.imageUrls,
      sellerName,
      sellerId: product.seller.id,
      rating: reviewAverage || undefined,
      reviewCount: reviews.length,
      stock: product.stock,
    },
    baseUrl,
  );

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: baseUrl },
    { name: "Marketplace", url: `${baseUrl}/buyer/marketplace` },
    { name: product.title, url: `${baseUrl}/products/${product.id}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 text-foreground">
      <div className="mb-6 text-sm text-foreground/60">
        <Link href="/buyer/marketplace" className="hover:text-(--accent-terra)">Marketplace</Link>
        <span> / </span>
        <span>{product.title}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          {product.imageUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrls[0]}
              alt={product.title}
              className="h-105 w-full rounded-2xl border border-(--accent-terra)/20 object-cover"
            />
          ) : (
            <div className="flex h-105 items-center justify-center rounded-2xl border border-dashed border-(--accent-terra)/30 bg-(--accent-beige)/20 text-sm text-foreground/60">
              No image available
            </div>
          )}

          {product.imageUrls.slice(1).length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {product.imageUrls.slice(1, 5).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={product.title} className="h-24 w-full rounded-lg border border-(--accent-terra)/20 object-cover" />
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-5">
          <div>
            <h1 className="text-4xl font-semibold text-(--accent-terra)">{product.title}</h1>
            <div className="mt-2 flex items-center gap-2">
              {sellerShopProfile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sellerShopProfile.logoUrl}
                  alt="Shop logo"
                  className="h-8 w-8 rounded-full border border-(--accent-terra)/30 object-cover"
                />
              ) : null}
              <Link href={`/shop/${product.seller.id}`} className="inline-block text-sm text-(--accent-green) hover:underline">
                {product.seller.sellerApplication?.shopName ?? product.seller.displayName ?? product.seller.email}
              </Link>
              {sellerShopProfile.verified ? (
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Verified seller
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-3xl font-semibold text-foreground">£{(product.priceCents / 100).toFixed(2)}</p>
            <div className="mt-2 flex items-center gap-2">
              {reviewAverage ? (
                <>
                  <span className="text-base tracking-tight text-amber-400">
                    {"★".repeat(Math.round(reviewAverage))}{"☆".repeat(5 - Math.round(reviewAverage))}
                  </span>
                  <span className="text-sm text-foreground/70">
                    {reviewAverage.toFixed(1)} · {reviews.length} review{reviews.length === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <span className="text-sm text-foreground/50">No reviews yet</span>
              )}
            </div>
          </div>

          <p className="text-base leading-7 text-foreground/80">{product.description}</p>

          <div className="grid gap-4 rounded-xl border border-(--accent-terra)/30 bg-white p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-foreground/50">Category</p>
              <p className="mt-1 text-sm text-foreground">{categories.length > 0 ? categories.join(", ") : "Not specified"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-foreground/50">Materials</p>
              <p className="mt-1 text-sm text-foreground">{meta.materials ?? "Not specified"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-foreground/50">Size / Dimensions</p>
              <p className="mt-1 text-sm text-foreground">{meta.dimensions ?? "Not specified"}</p>
            </div>
            {variants.length > 0 ? (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-foreground/50">Variants</p>
                <p className="mt-1 text-sm text-foreground">{variants.map((variant) => variant.label).join(", ")}</p>
              </div>
            ) : null}
          </div>

          <ProductDetailActions productId={product.id} priceCents={product.priceCents} maxQuantity={product.stock} variants={variants} />
          <div>
            <SavedItemButton
              listType="wishlist"
              item={{ id: product.id, label: product.title, href: `/products/${product.id}` }}
              requireAuth={!session?.user}
              loginRedirectPath={`/products/${product.id}`}
            />
          </div>
        </section>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          {session?.user?.role === Role.BUYER ? (
            <ReviewForm productId={product.id} />
          ) : session?.user ? (
            <div className="rounded-xl border border-(--accent-terra)/30 bg-white p-4 text-sm text-foreground/70">
              Only buyer accounts can leave product reviews.
            </div>
          ) : (
            <div className="rounded-xl border border-(--accent-terra)/30 bg-white p-4 text-sm text-foreground/70">
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/products/${product.id}`)}`} className="text-(--accent-terra) underline">
                Sign in
              </Link>{" "}
              to review this item.
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-(--accent-terra)">Reviews</h2>
          <div className="mt-4 space-y-4">
            {reviews.length === 0 ? <p className="text-sm text-foreground/60">No reviews yet.</p> : null}
            {reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-(--accent-terra)/25 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{review.buyer.displayName ?? review.buyer.email}</p>
                    <span className="text-sm tracking-tight text-amber-400">
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/50">
                    {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground/80">{review.body}</p>
                </article>
            ))}
          </div>
        </div>
      </section>
      </main>
    </>
  );
}