import "dotenv/config";

import { prisma } from "@/lib/prisma";

const keepEmail = "daxeon676@gmail.com";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  const target = users.find((u) => u.email.toLowerCase() === keepEmail.toLowerCase());
  if (!target) {
    throw new Error(`Required admin account not found: ${keepEmail}`);
  }

  const extraUserIds = users
    .filter((u) => u.id !== target.id)
    .map((u) => u.id);

  if (extraUserIds.length === 0) {
    console.log("No extra users to prune.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.disputeMessage.deleteMany({});
    await tx.dispute.deleteMany({});
    await tx.sellerPayout.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.orderItem.deleteMany({});
    await tx.order.deleteMany({});

    await tx.review.deleteMany({});
    await tx.cartItem.deleteMany({});
    await tx.cart.deleteMany({});
    await tx.product.deleteMany({});

    await tx.notification.deleteMany({});
    await tx.savedAddress.deleteMany({});
    await tx.passwordResetToken.deleteMany({});
    await tx.pendingCheckout.deleteMany({});
    await tx.sellerFollow.deleteMany({});

    await tx.conversationParticipant.deleteMany({});
    await tx.message.deleteMany({});
    await tx.conversation.deleteMany({});

    await tx.sellerApplication.deleteMany({});
    await tx.deliveryProfile.deleteMany({});
    await tx.shopProfile.deleteMany({});

    await tx.cookieConsentLog.deleteMany({});
    await tx.dsarRequest.deleteMany({});
    await tx.stripeWebhookEvent.deleteMany({});
    await tx.auditLog.deleteMany({});
    await tx.immutableAuditLog.deleteMany({});

    await tx.user.deleteMany({ where: { id: { in: extraUserIds } } });
  });

  console.log(`Pruned ${extraUserIds.length} extra user account(s). Kept ${keepEmail}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
