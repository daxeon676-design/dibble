import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { SellerSettingsClient } from "@/app/seller/settings/seller-settings-client";
import { authOptions } from "@/lib/auth";
import { getSellerShopProfile } from "@/lib/site-config";

export default async function ShopSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/settings");
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/buyer/profile");
  }

  const profile = await getSellerShopProfile(session.user.id);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-(--accent-terra)">Shop Settings</h1>
          <p className="mt-2 text-sm text-foreground/70">Manage your public shop profile, description, logo, and social links.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/seller" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Seller Dashboard
          </Link>
          <Link href={`/shop/${session.user.id}`} className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            View Public Shop
          </Link>
        </div>
      </div>

      <SellerSettingsClient initialProfile={profile} />
    </main>
  );
}
