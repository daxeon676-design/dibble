import { getServerSession } from "next-auth";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductCategories, getProductMetaMap, getProductVariants } from "@/lib/site-config";

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [products, meta] = await Promise.all([
    prisma.product.findMany({
      where: { sellerId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        stock: true,
        status: true,
        imageUrls: true,
      },
    }),
    getProductMetaMap(),
  ]);

  const header = [
    "id",
    "title",
    "description",
    "price_gbp",
    "stock",
    "status",
    "categories",
    "materials",
    "dimensions",
    "draft",
    "publish_at",
    "variants_json",
    "images_json",
  ];

  const rows = products.map((product) => {
    const productMeta = meta[product.id];

    return [
      product.id,
      product.title,
      product.description,
      (product.priceCents / 100).toFixed(2),
      String(product.stock),
      product.status,
      getProductCategories(productMeta).join("|"),
      productMeta?.materials ?? "",
      productMeta?.dimensions ?? "",
      productMeta?.draft ? "true" : "false",
      productMeta?.publishAt ?? "",
      JSON.stringify(getProductVariants(productMeta)),
      JSON.stringify(product.imageUrls),
    ];
  });

  const content = [header, ...rows]
    .map((row) => row.map((entry) => csvCell(String(entry ?? ""))).join(","))
    .join("\r\n");

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=seller-products-export.csv",
    },
  });
}
