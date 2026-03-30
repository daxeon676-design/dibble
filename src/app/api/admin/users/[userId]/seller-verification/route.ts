import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSellerShopProfile, setSellerShopProfile } from "@/lib/site-config";

const schema = z.object({
  verified: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });

  if (!target || target.role !== Role.SELLER) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  const existingProfile = await getSellerShopProfile(userId);
  await setSellerShopProfile(userId, { verified: parsed.data.verified });

  await prisma.auditLog.create({
    data: {
      actorAdmin: session.user.id,
      action: parsed.data.verified ? "SELLER_VERIFIED" : "SELLER_UNVERIFIED",
      targetType: "User",
      targetId: userId,
      details: `${existingProfile.verified ? "verified" : "unverified"} -> ${parsed.data.verified ? "verified" : "unverified"}`,
    },
  });

  return NextResponse.json({ ok: true, verified: parsed.data.verified });
}
