/**
 * Integration test utilities and helpers
 */

import { prisma } from "@/lib/prisma";

export async function setupTestUser(role: "BUYER" | "SELLER" | "ADMIN" = "BUYER") {
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      passwordHash: "hashed_password",
      role,
      displayName: `Test ${role}`,
    },
  });
  return user;
}

export async function setupTestProduct(sellerId: string) {
  const product = await prisma.product.create({
    data: {
      sellerId,
      title: "Test Product",
      description: "A test product",
      priceCents: 2999,
      stock: 10,
    },
  });
  return product;
}

export async function setupTestOrder(buyerId: string, sellerId: string, productId: string) {
  const order = await prisma.order.create({
    data: {
      buyerId,
      sellerId,
      status: "PENDING_PAYMENT",
      totalCents: 2999,
      items: {
        create: {
          productId,
          quantity: 1,
          unitPriceCents: 2999,
          productSnapshot: JSON.stringify({ title: "Test Product" }),
        },
      },
    },
  });

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      amountCents: 2999,
      status: "PENDING",
    },
  });

  return { order, payment };
}

export async function setupTestCheckoutSession(buyerId: string, sellerId: string, productId: string) {
  const checkout = await prisma.pendingCheckout.create({
    data: {
      buyerId,
      deliveryOptionId: "standard",
      deliveryOptionName: "Standard Delivery",
      totalCents: 2999,
      cartSnapshot: [
        {
          productId,
          quantity: 1,
          unitPriceCents: 2999,
        },
      ],
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  return checkout;
}

export function mockStripeTransfer() {
  return {
    id: "tr_test_" + Math.random().toString(36).substring(7),
    object: "transfer",
    amount: 2999,
    amount_reversed: 0,
    balance_transaction: "txn_test",
    created: Math.floor(Date.now() / 1000),
    currency: "gbp",
    description: "Payout test",
    destination: "acct_test",
    destination_payment: "py_test",
    metadata: {},
    reversals: { object: "list", data: [], has_more: false, url: "/v1/transfers/test/reversals" },
    reversed: false,
    source_transaction: null,
    source_type: "card",
    statement_descriptor: null,
    status: "paid",
    type: "stripe_account",
  };
}

export async function cleanupTest() {
  // Clean up test data - be careful with production databases!
  // This should only run in test environments
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Cleanup only allowed in test environment");
  }
}

/**
 * Full payment-to-payout lifecycle test
 */
export async function testPaymentToPayout(sellerId: string) {
  // 1. Create product
  const product = await setupTestProduct(sellerId);

  // 2. Create buyer
  const buyer = await setupTestUser("BUYER");

  // 3. Create order
  const { order, payment } = await setupTestOrder(buyer.id, sellerId, product.id);

  // 4. Simulate payment success
  payment.status = "SUCCEEDED";
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCEEDED" },
  });

  // 5. Create payout
  const payout = await prisma.sellerPayout.create({
    data: {
      orderId: order.id,
      sellerId,
      amountCents: product.priceCents,
      platformFeeCents: Math.round(product.priceCents * 0.15),
      netAmountCents: Math.round(product.priceCents * 0.85),
      status: "PLATFORM_PENDING",
    },
  });

  // 6. Simulate transfer
  const transfer = mockStripeTransfer();
  payout.status = "SUCCEEDED";
  payout.stripeTransferId = transfer.id;
  await prisma.sellerPayout.update({
    where: { id: payout.id },
    data: {
      status: "SUCCEEDED",
      stripeTransferId: transfer.id,
    },
  });

  return {
    buyer,
    product,
    order,
    payment,
    payout,
    transfer,
  };
}
