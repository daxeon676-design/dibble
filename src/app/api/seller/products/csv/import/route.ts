import { getServerSession } from "next-auth";
import { z } from "zod";

import { ProductStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeProductVariants, setProductMeta } from "@/lib/site-config";

const schema = z.object({
  csv: z.string().min(1),
  mode: z.enum(["upsert", "create-only"]).default("upsert"),
});

type ParsedRow = Record<string, string>;

function parseCsv(content: string): ParsedRow[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((entry) => entry.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: ParsedRow = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = values[i] ?? "";
    }
    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseOptionalJson<T>(value: string, fallback: T): T {
  try {
    if (!value.trim()) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const rows = parseCsv(parsed.data.csv);
  if (rows.length === 0) {
    return Response.json({ error: "CSV is empty or missing rows." }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const title = (row.title ?? "").trim();
    const description = (row.description ?? "").trim();
    const rawPrice = Number(row.price_gbp ?? "");
    const rawStock = Number(row.stock ?? "");

    if (!title || !description || !Number.isFinite(rawPrice) || !Number.isFinite(rawStock)) {
      errors.push(`Row ${index + 2}: invalid title/description/price_gbp/stock.`);
      continue;
    }

    const priceCents = Math.max(1, Math.round(rawPrice * 100));
    const stock = Math.max(0, Math.trunc(rawStock));

    const categories = (row.categories ?? "")
      .split("|")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const imageUrls = parseOptionalJson<string[]>(row.images_json ?? "", []);
    const variants = normalizeProductVariants(parseOptionalJson(row.variants_json ?? "", []));

    const productPatch = {
      title,
      description,
      priceCents,
      stock,
      status: row.status === ProductStatus.DELISTED ? ProductStatus.DELISTED : ProductStatus.ACTIVE,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    };

    const rowId = (row.id ?? "").trim();

    if (parsed.data.mode === "upsert" && rowId) {
      const existing = await prisma.product.findFirst({
        where: {
          id: rowId,
          sellerId: session.user.id,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: rowId },
          data: productPatch,
        });

        await setProductMeta(rowId, {
          categories,
          category: categories[0],
          materials: row.materials?.trim() || undefined,
          dimensions: row.dimensions?.trim() || undefined,
          draft: row.draft?.trim().toLowerCase() === "true",
          publishAt: row.publish_at?.trim() || undefined,
          variants,
        });

        updated += 1;
        continue;
      }
    }

    const createdProduct = await prisma.product.create({
      data: {
        sellerId: session.user.id,
        ...productPatch,
      },
    });

    await setProductMeta(createdProduct.id, {
      categories,
      category: categories[0],
      materials: row.materials?.trim() || undefined,
      dimensions: row.dimensions?.trim() || undefined,
      draft: row.draft?.trim().toLowerCase() === "true",
      publishAt: row.publish_at?.trim() || undefined,
      variants,
    });

    created += 1;
  }

  return Response.json({
    created,
    updated,
    failed: errors.length,
    errors,
  });
}
