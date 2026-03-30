import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role, PaymentStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/dac7-export?year=2025
 *
 * Produces a CSV of seller gross income for the UK tax year ending 5 April of the given year
 * (i.e. 6 April year-1 → 5 April year).
 *
 * Required for HMRC DAC7 / Finance Act 2021 marketplace operator reporting obligations.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  // UK tax year: 6 April (year-1) → 5 April (year)
  const periodStart = new Date(`${year - 1}-04-06T00:00:00.000Z`);
  const periodEnd = new Date(`${year}-04-05T23:59:59.999Z`);

  const sellers = await prisma.user.findMany({
    where: { role: Role.SELLER },
    select: {
      id: true,
      displayName: true,
      email: true,
      sellerApplication: {
        select: {
          shopName: true,
          businessType: true,
          businessAddress: true,
          vatNumber: true,
        },
      },
      sellerOrders: {
        where: {
          createdAt: { gte: periodStart, lte: periodEnd },
          payment: { status: PaymentStatus.SUCCEEDED },
        },
        select: {
          totalCents: true,
        },
      },
    },
  });

  const rows: string[][] = [
    [
      "Seller ID",
      "Shop Name",
      "Display Name",
      "Email",
      "Business Type",
      "Trading Address",
      "VAT Number",
      "Gross Orders",
      "Gross Sales (GBP)",
      "Tax Year",
    ],
  ];

  for (const seller of sellers) {
    const grossCents = seller.sellerOrders.reduce((sum, o) => sum + o.totalCents, 0);
    rows.push([
      seller.id,
      seller.sellerApplication?.shopName ?? "",
      seller.displayName ?? "",
      seller.email,
      seller.sellerApplication?.businessType ?? "",
      seller.sellerApplication?.businessAddress ?? "",
      seller.sellerApplication?.vatNumber ?? "",
      String(seller.sellerOrders.length),
      (grossCents / 100).toFixed(2),
      `${year - 1}/04/06 – ${year}/04/05`,
    ]);
  }

  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dibble-dac7-${year}.csv"`,
    },
  });
}
