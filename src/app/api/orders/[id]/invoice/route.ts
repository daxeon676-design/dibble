import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { PaymentStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
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
      const lineTotal = ((item.unitPriceCents * item.quantity) / 100).toFixed(2);
      return `- ${item.product.title} x ${item.quantity} @ GBP ${(item.unitPriceCents / 100).toFixed(2)} = GBP ${lineTotal}`;
    })
    .join("\n");

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

  return new NextResponse(invoice, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename=invoice-${order.id.slice(0, 8).toLowerCase()}.txt`,
    },
  });
}
