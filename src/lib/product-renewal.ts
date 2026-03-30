import { appBaseUrl } from "@/lib/email";
import { logApiEvent } from "@/lib/observability";
import { sendPreferenceAwareEmail } from "@/lib/preference-email";
import { prisma } from "@/lib/prisma";

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
const TWO_MONTHS_MS = 61 * 24 * 60 * 60 * 1000; // ~2 calendar months

export interface ProductRenewalResult {
  notified: number;
  autoExpired: number;
}

/**
 * Called daily by the ops cron job.
 *
 * Step 1 — Notify:  products where listedAt + 12 months <= now() and
 *                   renewalNotifiedAt is null and status = ACTIVE.
 *                   Sends seller email and marks renewalNotifiedAt = now().
 *
 * Step 2 — Expire:  products where renewalNotifiedAt + 2 months <= now()
 *                   and status = ACTIVE.
 *                   Products with no order history are deleted; others are
 *                   delisted to preserve financial records.
 */
export async function runProductRenewalChecks(): Promise<ProductRenewalResult> {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - TWELVE_MONTHS_MS);
  const twoMonthsAgo = new Date(now.getTime() - TWO_MONTHS_MS);
  const baseUrl = appBaseUrl();

  // ── Step 1: send renewal reminders ──────────────────────────────────────
  const needsNotification = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      renewalNotifiedAt: null,
      listedAt: { lte: twelveMonthsAgo },
    },
    select: {
      id: true,
      title: true,
      seller: { select: { id: true, email: true, displayName: true } },
    },
  });

  for (const product of needsNotification) {
    const sellerName = product.seller.displayName ?? "Seller";
    const renewUrl = `${baseUrl}/seller/products`;
    const emailHtml = `
      <p>Hi ${sellerName},</p>
      <p>Your product <strong>${product.title}</strong> has been listed on Dibble for 12 months.</p>
      <p>To keep it active, please <a href="${renewUrl}">log in and renew it</a> within the next 2 months.</p>
      <p>If no action is taken the product will be automatically removed.</p>
      <p>Thank you,<br/>The Dibble Team<br/><a href="${baseUrl}">${baseUrl}</a></p>
    `;

    const sent = await sendPreferenceAwareEmail({
      userId: product.seller.id,
      preferenceKey: "sellerProductUpdates",
      to: product.seller.email,
      subject: `Action required: renew "${product.title}" on Dibble`,
      html: emailHtml,
    });

    await prisma.product.update({
      where: { id: product.id },
      data: { renewalNotifiedAt: now },
    });

    // In-app notification
    await prisma.notification.create({
      data: {
        userId: product.seller.id,
        type: "SYSTEM",
        title: "Product renewal required",
        body: `Your product "${product.title}" has been listed for 12 months. Please renew it within 2 months to keep it active.`,
        href: "/seller/products",
        productId: product.id,
      },
    });

    logApiEvent("info", "product.renewal.notified", {
      productId: product.id,
      sellerId: product.seller.id,
      emailSent: sent,
    });
  }

  // ── Step 2: auto-expire overdue products ─────────────────────────────────
  const overdue = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      renewalNotifiedAt: { lte: twoMonthsAgo },
    },
    select: {
      id: true,
      title: true,
      seller: { select: { id: true, email: true, displayName: true } },
      _count: { select: { orderItems: true } },
    },
  });

  let autoExpired = 0;

  for (const product of overdue) {
    const hasOrders = product._count.orderItems > 0;

    if (hasOrders) {
      // Delist to preserve order history FK integrity
      await prisma.product.update({
        where: { id: product.id },
        data: { status: "DELISTED" },
      });
    } else {
      // Safe to hard-delete (CartItems cascade)
      await prisma.product.delete({ where: { id: product.id } });
    }

    // Notify seller of removal
    const sellerName = product.seller.displayName ?? "Seller";
    await sendPreferenceAwareEmail({
      userId: product.seller.id,
      preferenceKey: "sellerProductUpdates",
      to: product.seller.email,
      subject: `Your product "${product.title}" has been removed from Dibble`,
      html: `
          <p>Hi ${sellerName},</p>
          <p>Your product <strong>${product.title}</strong> was not renewed within the 2-month window and has been removed from Dibble.</p>
          <p>You can re-list it at any time by <a href="${baseUrl}/seller/products">creating a new product</a>.</p>
          <p>Thank you,<br/>The Dibble Team</p>
        `,
    });

    await prisma.notification.create({
      data: {
        userId: product.seller.id,
        type: "SYSTEM",
        title: "Product removed",
        body: `"${product.title}" was not renewed and has been removed. You can re-list it at any time.`,
        href: "/seller/products",
      },
    });

    logApiEvent("info", "product.renewal.expired", {
      productId: product.id,
      sellerId: product.seller.id,
      action: hasOrders ? "delisted" : "deleted",
    });

    autoExpired++;
  }

  return { notified: needsNotification.length, autoExpired };
}
