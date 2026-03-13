import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationsClient from "@/app/buyer/notifications/notifications-client";

export const metadata = { title: "Notifications - Dibble" };

export default async function BuyerNotificationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/buyer/notifications");
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <NotificationsClient initialNotifications={notifications} />;
}
