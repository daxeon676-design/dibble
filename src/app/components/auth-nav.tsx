import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSiteConfig } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";
import { NavClient } from "@/app/components/nav-client";

export async function AuthNav() {
  const session = await getServerSession(authOptions);
  const config = await getSiteConfig();
  let unreadNotifications = 0;

  if (session?.user?.id) {
    try {
      unreadNotifications = await prisma.notification.count({
        where: {
          userId: session.user.id,
          readAt: null,
        },
      });
    } catch (error) {
      console.warn("AuthNav notification count unavailable, defaulting to 0.", error);
    }
  }

  return (
    <NavClient
      user={session?.user ?? null}
      unreadCount={unreadNotifications}
      categories={config.categories}
    />
  );
}
