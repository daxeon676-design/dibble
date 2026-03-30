import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { PaymentStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: { title: true },
          },
        },
      },
      buyer: {
        select: { email: true, displayName: true },
      },
      seller: {
        select: { email: true, displayName: true },
      },
      payment: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === Role.ADMIN;
  const isBuyer = order.buyerId === session.user.id;
  const isSeller = order.sellerId === session.user.id;

  if (!isAdmin && !isBuyer && !isSeller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.payment?.status !== PaymentStatus.SUCCEEDED) {
    return NextResponse.json({ error: "Invoice is only available after successful payment." }, { status: 409 });
  }

  const invoiceNumber = `DIB-${order.id.slice(0, 8).toUpperCase()}`;
  const issuedAt = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const itemLines = order.items
    .map((item) => {
      const snapshot = safeParseSnapshot(item.productSnapshot);
      const displayTitle = snapshot?.title ?? item.product.title;
      const lineTotal = ((item.unitPriceCents * item.quantity) / 100).toFixed(2);
      return `- ${displayTitle} x ${item.quantity} @ GBP ${(item.unitPriceCents / 100).toFixed(2)} = GBP ${lineTotal}`;
    })
    .join("\n");

  const itemRowsHtml = order.items
    .map((item) => {
      const snapshot = safeParseSnapshot(item.productSnapshot);
      const displayTitle = snapshot?.title ?? item.product.title;
      const lineTotal = ((item.unitPriceCents * item.quantity) / 100).toFixed(2);
      return `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(displayTitle)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">GBP ${(item.unitPriceCents / 100).toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">GBP ${lineTotal}</td></tr>`;
    })
    .join("");

  const invoice = [
    "Dibble Marketplace Invoice",
    `Invoice: ${invoiceNumber}`,
    `Order ID: ${order.id}`,
    `Date: ${issuedAt}`,
    "",
    `Buyer: ${order.buyer.displayName ?? order.buyer.email}`,
    `Seller: ${order.seller.displayName ?? order.seller.email}`,
    "",
    "Items:",
    itemLines,
    "",
    `TOTAL: GBP ${(order.totalCents / 100).toFixed(2)}`,
    `Payment Status: ${order.payment.status}`,
  ].join("\n");

  const invoiceHtml = `
    <html>
      <body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px">
        <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:20px">
          <h1 style="margin:0 0 6px 0;font-size:20px">Dibble Marketplace Invoice</h1>
          <p style="margin:0 0 12px 0;color:#475569">Invoice ${invoiceNumber} · ${issuedAt}</p>

          <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:14px">
            <div>
              <p style="margin:0;font-size:12px;color:#64748b">Buyer</p>
              <p style="margin:2px 0 0 0">${escapeHtml(order.buyer.displayName ?? order.buyer.email)}</p>
            </div>
            <div>
              <p style="margin:0;font-size:12px;color:#64748b">Seller</p>
              <p style="margin:2px 0 0 0">${escapeHtml(order.seller.displayName ?? order.seller.email)}</p>
            </div>
            <div>
              <p style="margin:0;font-size:12px;color:#64748b">Order ID</p>
              <p style="margin:2px 0 0 0">${escapeHtml(order.id)}</p>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;background:#f1f5f9">Item</th>
                <th style="text-align:right;padding:8px;background:#f1f5f9">Qty</th>
                <th style="text-align:right;padding:8px;background:#f1f5f9">Unit</th>
                <th style="text-align:right;padding:8px;background:#f1f5f9">Line Total</th>
              </tr>
            </thead>
            <tbody>${itemRowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding:10px;text-align:right;font-weight:700">Total</td>
                <td style="padding:10px;text-align:right;font-weight:700">GBP ${(order.totalCents / 100).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <p style="margin:14px 0 0 0;font-size:12px;color:#64748b">Payment Status: ${escapeHtml(order.payment.status)}</p>
        </div>
      </body>
    </html>
  `;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format")?.toLowerCase();

  if (format === "txt") {
    return new NextResponse(invoice, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=invoice-${order.id.slice(0, 8).toLowerCase()}.txt`,
      },
    });
  }

  return new NextResponse(invoiceHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename=invoice-${order.id.slice(0, 8).toLowerCase()}.html`,
    },
  });
}

function safeParseSnapshot(value: string): { title?: string } | null {
  try {
    return JSON.parse(value) as { title?: string };
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
