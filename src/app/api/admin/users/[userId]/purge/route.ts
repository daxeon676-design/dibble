import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/users/[userId]/purge
 *
 * Permanently removes all PII for a user:
 *  - Anonymises the User record (email, name, address fields, passwordHash)
 *  - Hard-deletes products that have no order history
 *  - Delists products that do have order history (preserves financial records)
 *  - Deletes: cart, pending checkouts, notifications, saved addresses,
 *             password-reset tokens, seller follows, conversation participations,
 *             seller application
 *
 * Blocked if:
 *  - Target is an ADMIN account
 *  - Target has open disputes (OPEN / UNDER_REVIEW)
 *  - Target has in-progress orders (PROCESSING / SHIPPED) as buyer or seller
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;

  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot purge your own account." }, { status: 409 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      displayName: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (target.role === Role.ADMIN) {
    return NextResponse.json({ error: "Admin accounts cannot be purged." }, { status: 409 });
  }

  // Block if open disputes exist
  const openDisputes = await prisma.dispute.count({
    where: {
      raisedById: userId,
      status: { in: ["OPEN", "UNDER_REVIEW"] },
    },
  });
  if (openDisputes > 0) {
    return NextResponse.json(
      { error: "User has open disputes. Resolve them before purging." },
      { status: 409 },
    );
  }

  // Block if active orders in progress
  const activeOrders = await prisma.order.count({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      status: { in: ["PROCESSING", "SHIPPED"] },
    },
  });
  if (activeOrders > 0) {
    return NextResponse.json(
      { error: "User has active in-progress orders. Complete or cancel them before purging." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    // --- Products ---
    const products = await tx.product.findMany({
      where: { sellerId: userId },
      select: {
        id: true,
        _count: { select: { orderItems: true } },
      },
    });

    const productIdsWithOrders = products
      .filter((p) => p._count.orderItems > 0)
      .map((p) => p.id);
    const productIdsWithoutOrders = products
      .filter((p) => p._count.orderItems === 0)
      .map((p) => p.id);

    // Delist products with order history (preserves FK integrity)
    if (productIdsWithOrders.length > 0) {
      await tx.product.updateMany({
        where: { id: { in: productIdsWithOrders } },
        data: { status: "DELISTED", sellerId: userId },
      });
    }

    // Hard-delete products with no order history (CartItems cascade)
    if (productIdsWithoutOrders.length > 0) {
      await tx.product.deleteMany({
        where: { id: { in: productIdsWithoutOrders } },
      });
    }

    // --- Cart ---
    const cart = await tx.cart.findUnique({
      where: { buyerId: userId },
      select: { id: true },
    });
    if (cart) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.delete({ where: { id: cart.id } });
    }

    // --- Cascade-eligible records ---
    await tx.pendingCheckout.deleteMany({ where: { buyerId: userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.savedAddress.deleteMany({ where: { userId } });
    await tx.sellerFollow.deleteMany({
      where: { OR: [{ sellerId: userId }, { buyerId: userId }] },
    });
    await tx.conversationParticipant.deleteMany({ where: { userId } });
    await tx.sellerApplication.deleteMany({ where: { userId } });

    // --- Anonymise user record (keeps row for FK integrity with orders/disputes) ---
    const anonymousEmail = `purged-${userId}@purged.invalid`;
    const randomHash = randomBytes(32).toString("hex");
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymousEmail,
        passwordHash: randomHash,
        displayName: null,
        bio: null,
        avatarUrl: null,
        phoneNumber: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        county: null,
        postcode: null,
        country: null,
        mfaEnabled: false,
        mfaSecret: null,
        status: "DELETED",
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorAdmin: session.user.id,
        action: "USER_PURGED",
        targetType: "User",
        targetId: userId,
        details: JSON.stringify({
          originalEmail: target.email,
          displayName: target.displayName,
          productsDeleted: productIdsWithoutOrders.length,
          productsDelisted: productIdsWithOrders.length,
        }),
      },
    });
  });

  logApiEvent("info", "admin.user.purged", {
    actorId: session.user.id,
    targetUserId: userId,
  });

  return NextResponse.json({ success: true, userId });
}
