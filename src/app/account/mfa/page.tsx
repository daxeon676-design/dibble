import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import AccountMfaClient from "@/app/account/mfa/account-mfa-client";
import { authOptions } from "@/lib/auth";

export default async function AccountMfaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/mfa");
  }

  const callbackPath =
    session.user.role === Role.ADMIN ? "/admin" : session.user.role === Role.SELLER ? "/seller" : "/buyer";

  return <AccountMfaClient callbackPath={callbackPath} />;
}
