import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { getEmailPreferences } from "@/lib/email-preferences";
import { prisma } from "@/lib/prisma";
import EmailPreferencesClient from "@/app/account/email-preferences/preferences-client";

export const metadata: Metadata = { title: "Email Preferences - Dibble" };

export default async function AccountEmailPreferencesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/email-preferences");
  }

  const [user, prefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { marketingOptIn: true, role: true },
    }),
    getEmailPreferences(session.user.id),
  ]);

  return (
    <EmailPreferencesClient
      callbackRole={user?.role ?? "BUYER"}
      initialPreferences={{
        marketingOptIn: Boolean(user?.marketingOptIn),
        accountUpdates: prefs.accountUpdates,
        orderUpdates: prefs.orderUpdates,
        disputeUpdates: prefs.disputeUpdates,
        returnUpdates: prefs.returnUpdates,
        productAnnouncements: prefs.productAnnouncements,
        sellerProductUpdates: prefs.sellerProductUpdates,
      }}
    />
  );
}
