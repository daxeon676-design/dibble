import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import SiteSettingsClient from "@/app/admin/site-settings/site-settings-client";

export default async function AdminSiteSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/site-settings");
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-slate-900">
      <h1 className="mb-2 text-3xl font-semibold">Site Settings</h1>
      <p className="mb-8 text-sm text-slate-600">
        Manage categories, delivery options, and website copy from one page.
      </p>
      <SiteSettingsClient />
    </main>
  );
}
