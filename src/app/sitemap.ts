import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://dibblemarketplace.com";

  try {
    // Get all active products for sitemap
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, updatedAt: true },
      take: 50000,
    });

    // Get all active sellers for sitemap
    const sellers = await prisma.user.findMany({
      where: { role: "SELLER", status: "ACTIVE" },
      select: { id: true, updatedAt: true },
      take: 50000,
    });

    const entries: MetadataRoute.Sitemap = [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${baseUrl}/buyer/marketplace`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.95,
      },
      {
        url: `${baseUrl}/shop`,
        lastModified: new Date(),
        changeFrequency: "hourly",
        priority: 0.9,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: `${baseUrl}/how-it-works`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: `${baseUrl}/faq`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        url: `${baseUrl}/privacy`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        url: `${baseUrl}/cookies`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.4,
      },
      {
        url: `${baseUrl}/returns`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.4,
      },

      // Dynamic product pages
      ...products.map((product) => ({
        url: `${baseUrl}/products/${product.id}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),

      // Dynamic seller pages
      ...sellers.map((seller) => ({
        url: `${baseUrl}/shop/${seller.id}`,
        lastModified: seller.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];

    return entries;
  } catch (error) {
    console.error("Sitemap generation error:", error);
    // Return minimal sitemap on error
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      },
    ];
  }
}
