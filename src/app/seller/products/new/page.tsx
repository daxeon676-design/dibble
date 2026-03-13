import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import NewProductForm from "@/app/seller/products/new/new-product-form";

export default async function NewSellerProductPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/seller/products/new");
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-slate-900">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">New Product</h1>
        <Link href="/seller/products" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Back to Your Products
        </Link>
      </div>
      <NewProductForm />
    </main>
  );
}
