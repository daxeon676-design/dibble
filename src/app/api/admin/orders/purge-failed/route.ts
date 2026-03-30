import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/orders/purge-failed
 *
 * Deletes orders that were never paid for (status = PENDING_PAYMENT).
 * Useful for clearing out test/trial records or abandoned checkouts.
 *
 * Cascade behaviour:
 *  - OrderItems are cascade-deleted by Prisma (onDelete: Cascade on Order)
 *  - Payments are cascade-deleted (onDelete: Cascade on Order)
 *
 * Orders with existing disputes are skipped to preserve dispute integrity.
 *
 * Returns the count of orders deleted.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find all PENDING_PAYMENT orders that have no dispute attached
  const candidates = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      dispute: null,
    },
    select: { id: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const ids = candidates.map((o) => o.id);

  // deleteMany is fine here — cascade rules handle items + payments
  const result = await prisma.order.deleteMany({ where: { id: { in: ids } } });

  logApiEvent("info", "admin.orders.purge_failed", {
    actorId: session.user.id,
    deleted: result.count,
  });

  await prisma.auditLog.create({
    data: {
      actorAdmin: session.user.id,
      action: "FAILED_ORDERS_PURGED",
      targetType: "Order",
      targetId: "bulk",
      details: JSON.stringify({ deleted: result.count }),
    },
  });

  return NextResponse.json({ deleted: result.count });
}
