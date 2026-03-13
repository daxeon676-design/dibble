import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { OrderStatus, PaymentStatus, ProductStatus, Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { calculateOrderTotalCents, groupCartItemsBySeller } from "@/lib/checkout";
import { getRequestId, logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { getSellerDeliveryOptionsMap, getSiteConfig } from "@/lib/site-config";

const createOrderSchema = z.object({
  deliveryOptionId: z.string().min(1),
  address: z.object({
    fullName: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where =
    session.user.role === Role.ADMIN
      ? {}
      : session.user.role === Role.SELLER
        ? { sellerId: session.user.id }
        : { buyerId: session.user.id };

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: {
        include: {
          product: {
            select: {
              title: true,
              description: true,
            },
          },
        },
      },
      buyer: {
        select: {
          email: true,
          displayName: true,
        },
      },
      seller: {
        select: {
          email: true,
          displayName: true,
        },
      },
      payment: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    logApiEvent("warn", "orders.create.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(json);
  if (!parsed.success) {
    logApiEvent("warn", "orders.create.invalid_payload", { requestId, userId: session.user.id });
    return NextResponse.json({ error: "Delivery option is required." }, { status: 400 });
  }

  const config = await getSiteConfig();
  const selectedDelivery = config.deliveryOptions.find(
    (option) => option.id === parsed.data.deliveryOptionId && option.enabled,
  );
  if (!selectedDelivery) {
    logApiEvent("warn", "orders.create.invalid_delivery_option", {
      requestId,
      userId: session.user.id,
      deliveryOptionId: parsed.data.deliveryOptionId,
    });
    return NextResponse.json({ error: "Selected delivery option is not available." }, { status: 409 });
  }

  const sellerDeliveryMap = await getSellerDeliveryOptionsMap();

  const cart = await prisma.cart.findUnique({
    where: { buyerId: session.user.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    logApiEvent("warn", "orders.create.empty_cart", { requestId, userId: session.user.id });
    return NextResponse.json({ error: "Cart is empty." }, { status: 409 });
  }

  const invalidItem = cart.items.find(
    (item) => item.product.status !== ProductStatus.ACTIVE || item.product.stock < item.quantity,
  );

  if (invalidItem) {
    logApiEvent("warn", "orders.create.invalid_item", {
      requestId,
      userId: session.user.id,
      productId: invalidItem.productId,
    });
    return NextResponse.json(
      { error: `Product ${invalidItem.product.title} is unavailable or out of stock.` },
      { status: 409 },
    );
  }

  const groupedBySeller = groupCartItemsBySeller(cart.items);

  const enabledOptionIds = config.deliveryOptions.filter((o) => o.enabled).map((o) => o.id);
  for (const sellerId of groupedBySeller.keys()) {
    const offered = sellerDeliveryMap[sellerId] ?? enabledOptionIds;
    if (!offered.includes(selectedDelivery.id)) {
      logApiEvent("warn", "orders.create.delivery_not_offered", {
        requestId,
        userId: session.user.id,
        sellerId,
        deliveryOptionId: selectedDelivery.id,
      });
      return NextResponse.json(
        { error: "Selected delivery option is not offered by one or more sellers in your cart." },
        { status: 409 },
      );
    }
  }

  const createdOrders = await prisma.$transaction(async (tx) => {
    const created = [] as Array<{ id: string }>;

    for (const [sellerId, items] of groupedBySeller.entries()) {
      const totalCents = calculateOrderTotalCents(items) + selectedDelivery.costPence;

      const order = await tx.order.create({
        data: {
          buyerId: session.user.id,
          sellerId,
          status: OrderStatus.PENDING_PAYMENT,
          totalCents,
          addressFullName: parsed.data.address?.fullName,
          addressLine1: parsed.data.address?.addressLine1,
          addressLine2: parsed.data.address?.addressLine2,
          addressCity: parsed.data.address?.city,
          addressPostalCode: parsed.data.address?.postalCode,
          addressCountry: parsed.data.address?.country,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCts,
              productSnapshot: JSON.stringify({
                title: item.product.title,
                description: item.product.description,
              }),
            })),
          },
          payment: {
            create: {
              amountCents: totalCents,
              status: PaymentStatus.PENDING,
            },
          },
        },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      created.push({ id: order.id });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  logApiEvent("info", "orders.create.success", {
    requestId,
    userId: session.user.id,
    orderCount: createdOrders.length,
    deliveryOptionId: selectedDelivery.id,
  });

  return NextResponse.json({ orders: createdOrders, deliveryOptionId: selectedDelivery.id }, { status: 201 });
}
