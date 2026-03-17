import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  listSellerPayouts,
  markSellerPayoutPaid,
  markSellerPayoutPaidWithTransfer,
} from "@/lib/seller-payout-ledger";

const markPaidSchema = z.object({
  orderId: z.string().min(1),
  payoutReference: z.string().max(160).optional(),
  stripeTransferId: z.string().optional(),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["all", "pending", "completed"]).default("all"),
  format: z.enum(["json", "csv"]).default("json"),
  from: z.string().optional(),
  to: z.string().optional(),
});

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function parseDateStart(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateEnd(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = listQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    format: searchParams.get("format") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const query = parsedQuery.success ? parsedQuery.data.q?.trim().toLowerCase() ?? "" : "";
  const statusFilter = parsedQuery.success ? parsedQuery.data.status : "all";
  const format = parsedQuery.success ? parsedQuery.data.format : "json";
  const from = parsedQuery.success ? parsedQuery.data.from ?? "" : "";
  const to = parsedQuery.success ? parsedQuery.data.to ?? "" : "";
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);

  const payouts = await listSellerPayouts();
  const sellerIds = [...new Set(payouts.map((entry) => entry.sellerId))];

  const sellers =
    sellerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, displayName: true, email: true },
        })
      : [];

  const sellerMap = new Map(sellers.map((seller) => [seller.id, seller.displayName ?? seller.email]));

  const filtered = payouts
    .filter((entry) => {
      if (statusFilter === "pending") return entry.status === "PLATFORM_PENDING";
      if (statusFilter === "completed") return entry.status !== "PLATFORM_PENDING";
      return true;
    })
    .filter((entry) => {
      if (!fromDate && !toDate) return true;
      const createdAt = new Date(entry.createdAt);
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;
      return true;
    })
    .map((entry) => ({
      ...entry,
      sellerName: sellerMap.get(entry.sellerId) ?? entry.sellerId,
    }))
    .filter((entry) => {
      if (!query) return true;
      return (
        entry.orderId.toLowerCase().includes(query) ||
        entry.sellerId.toLowerCase().includes(query) ||
        entry.sellerName.toLowerCase().includes(query) ||
        (entry.payoutReference ?? "").toLowerCase().includes(query)
      );
    });

  if (format === "csv") {
    const headers = [
      "order_id",
      "seller_id",
      "seller_name",
      "status",
      "gross_cents",
      "platform_fee_cents",
      "seller_payout_cents",
      "created_at",
      "updated_at",
      "paid_at",
      "payout_reference",
      "stripe_transfer_id",
    ];

    const rows = filtered.map((entry) => [
      entry.orderId,
      entry.sellerId,
      entry.sellerName,
      entry.status,
      String(entry.grossCents),
      String(entry.platformFeeCents),
      String(entry.sellerPayoutCents),
      entry.createdAt,
      entry.updatedAt,
      entry.paidAt ?? "",
      entry.payoutReference ?? "",
      entry.stripeTransferId ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsv(String(value))).join(","))
      .join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=admin-payouts.csv",
      },
    });
  }

  return NextResponse.json({
    payouts: filtered,
    count: filtered.length,
    filters: {
      q: query,
      status: statusFilter,
      from,
      to,
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit(request, {
    scope: "admin-payouts-write",
    limit: 120,
    windowMs: 60_000,
    key: `admin:${session.user.id}`,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many payout write actions. Please retry shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = markPaidSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = parsed.data.stripeTransferId
    ? await markSellerPayoutPaidWithTransfer(parsed.data.orderId, parsed.data.stripeTransferId)
    : await markSellerPayoutPaid(parsed.data.orderId, parsed.data.payoutReference);

  if (!updated) {
    return NextResponse.json({ error: "Payout entry not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, payout: updated });
}
