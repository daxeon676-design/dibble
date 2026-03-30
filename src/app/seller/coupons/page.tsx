import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import CouponsManagerClient from "@/app/coupons/coupons-manager-client";
import { authOptions } from "@/lib/auth";
import { listCouponsBySeller } from "@/lib/coupons";

export default async function SellerCouponsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/seller/coupons");
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const coupons = await listCouponsBySeller(session.user.id);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-slate-900">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Your Coupon Codes</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create and manage promo codes for your own products.
          </p>
        </div>
        <Link href="/seller" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Back to Seller Dashboard
        </Link>
      </div>
      <CouponsManagerClient canAssignSeller={false} initialCoupons={coupons} />
    </main>
  );
}
