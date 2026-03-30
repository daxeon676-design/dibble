/**
 * User data export and privacy utilities
 */

import { prisma } from "@/lib/prisma";

export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      buyerOrders: {
        include: {
          items: true,
          payment: true,
        },
      },
      sellerOrders: true,
      savedAddresses: true,
      productReviews: true,
    },
  });

  if (!user) return null;

  // Create comprehensive data export
  const userData = {
    profile: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
      bio: user.bio,
      avatar: user.avatarUrl,
      contact: {
        phone: user.phoneNumber,
        address: {
          line1: user.addressLine1,
          line2: user.addressLine2,
          city: user.city,
          county: user.county,
          postcode: user.postcode,
          country: user.country,
        },
      },
    },
    saved_addresses: user.savedAddresses,
    purchase_history: user.buyerOrders,
    sales_history: user.sellerOrders,
    reviews: user.productReviews,
    exported_at: new Date().toISOString(),
  };

  return userData;
}

export async function scheduleUserDeletion(userId: string, delayDays: number = 30) {
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + delayDays);

  // Schedule deletion - in production, use a background job
  console.log(`[SCHEDULED] User ${userId} for deletion on ${deletionDate.toISOString()}`);

  // Create notification
  await prisma.notification.create({
    data: {
      userId,
      type: "SYSTEM",
      title: "Account Deletion Scheduled",
      body: `Your account will be permanently deleted on ${deletionDate.toLocaleDateString()}. You can cancel this anytime.`,
    },
  });

  return { deletionScheduledFor: deletionDate };
}

export async function cancelUserDeletion(userId: string) {
  // Remove deletion schedule - in production, cancel the scheduled job
  console.log(`[CANCELLED] User deletion for ${userId}`);

  await prisma.notification.create({
    data: {
      userId,
      type: "SYSTEM",
      title: "Account Deletion Cancelled",
      body: "Your account deletion has been cancelled. Your data remains safe.",
    },
  });

  return { cancellationConfirmed: true };
}
