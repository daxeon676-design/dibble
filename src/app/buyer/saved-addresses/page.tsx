import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SavedAddressesClient } from "@/app/buyer/saved-addresses/saved-addresses-client";

export default async function SavedAddressesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/buyer/saved-addresses");
  }

  const addresses = await prisma.savedAddress.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return <SavedAddressesClient initialAddresses={addresses} />;
}
