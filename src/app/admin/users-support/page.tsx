import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DisputeStatus, Role, SellerApplicationStatus, UserStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSellerShopProfiles } from "@/lib/site-config";
import { getUserModerationFlags } from "@/lib/user-moderation-flags";
import UsersSupportClient from "@/app/admin/users-support/users-support-client";

export const metadata: Metadata = { title: "Users & Support - Admin" };

export default async function AdminUsersSupportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/login?callbackUrl=/admin/users-support");
  }

  const [
    users,
    openDisputes,
    pendingSellerApplications,
    buyersWithUnreadMessages,
    sellersWithUnreadMessages,
    sellerShopProfiles,
    moderationFlags,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        mfaEnabled: true,
        createdAt: true,
        sellerApplication: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.dispute.count({
      where: {
        status: {
          in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
        },
      },
    }),
    prisma.sellerApplication.count({ where: { status: SellerApplicationStatus.PENDING } }),
    prisma.conversationParticipant.count({ where: { readAt: null, user: { role: Role.BUYER } } }),
    prisma.conversationParticipant.count({ where: { readAt: null, user: { role: Role.SELLER } } }),
    getSellerShopProfiles(),
    getUserModerationFlags(),
  ]);

  const summary = {
    openDisputes,
    pendingSellerApplications,
    buyersWithUnreadMessages,
    sellersWithUnreadMessages,
    suspendedUsers: users.filter((user) => user.status === UserStatus.SUSPENDED).length,
    activeUsers: users.filter((user) => user.status === UserStatus.ACTIVE).length,
    flaggedUsers: users.filter((user) => moderationFlags[user.id]?.flagged).length,
  };

  const normalizedUsers = users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt.toISOString(),
    sellerApplicationStatus: user.sellerApplication?.status ?? null,
    sellerVerified: user.role === Role.SELLER ? Boolean(sellerShopProfiles[user.id]?.verified) : null,
    moderationFlagged: Boolean(moderationFlags[user.id]?.flagged),
    moderationFlagReason: moderationFlags[user.id]?.reason ?? null,
  }));

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12 text-slate-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Users & Support</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage account status, monitor support load, and triage seller/buyer operations quickly.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/disputes" className="rounded border border-slate-300 px-3 py-2 text-sm">
            Open Disputes
          </Link>
          <Link href="/admin/returns" className="rounded border border-slate-300 px-3 py-2 text-sm">
            Returns
          </Link>
          <Link href="/admin" className="rounded border border-slate-300 px-3 py-2 text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>

      <UsersSupportClient initialUsers={normalizedUsers} summary={summary} />
    </main>
  );
}
