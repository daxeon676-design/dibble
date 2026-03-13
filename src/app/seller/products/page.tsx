import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SellerProductsManager } from "@/app/seller/products/products-manager";
import { getProductMetaMap, getSiteConfig } from "@/lib/site-config";

export default async function SellerProductsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/seller/products");
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const [productsRaw, meta, config] = await Promise.all([
    prisma.product.findMany({
      where: { sellerId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    getProductMetaMap(),
    getSiteConfig(),
  ]);

  const products = productsRaw.map((p) => ({
    ...p,
    category: meta[p.id]?.category ?? "",
    materials: meta[p.id]?.materials ?? "",
    dimensions: meta[p.id]?.dimensions ?? "",
  }));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 text-slate-900">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Your Products</h1>
        <div className="flex items-center gap-2">
          <Link href="/seller/products/new" className="rounded-md bg-(--accent-terra) px-3 py-2 text-sm font-semibold text-(--accent-beige)">
            Create Product
          </Link>
          <Link href="/seller" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Back to Seller Dashboard
          </Link>
        </div>
      </div>
      <SellerProductsManager initialProducts={products} categories={config.categories} />
    </main>
  );
}
