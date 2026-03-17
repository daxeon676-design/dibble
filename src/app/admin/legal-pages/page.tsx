import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import LegalPagesEditorClient from "@/app/admin/legal-pages/legal-pages-editor-client";

export default async function AdminLegalPagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/legal-pages");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-slate-900">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Legal & Policy Content</h1>
          <p className="mt-1 text-sm text-slate-600">
            Edit About, FAQ, Terms, and Privacy pages visible on the public site.
          </p>
        </div>
        <Link href="/admin/site-settings" className="rounded border border-slate-300 px-3 py-2 text-sm">
          Back to Site Settings
        </Link>
      </div>

      <LegalPagesEditorClient />
    </main>
  );
}
