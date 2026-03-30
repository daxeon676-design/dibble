import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import CouponsManagerClient from "@/app/coupons/coupons-manager-client";
import { authOptions } from "@/lib/auth";
import { listCoupons } from "@/lib/coupons";

export default async function AdminCouponsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/coupons");
  }

  const coupons = await listCoupons();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-slate-900">
      <h1 className="mb-2 text-3xl font-semibold">Coupon Management</h1>
      <p className="mb-8 text-sm text-slate-600">
        Create marketplace-wide or seller-scoped promotional codes.
      </p>
      <CouponsManagerClient canAssignSeller initialCoupons={coupons} />
    </main>
  );
}
