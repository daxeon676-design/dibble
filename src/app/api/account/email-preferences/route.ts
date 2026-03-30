import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getEmailPreferences, setEmailPreferences } from "@/lib/email-preferences";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  marketingOptIn: z.boolean().optional(),
  accountUpdates: z.boolean().optional(),
  orderUpdates: z.boolean().optional(),
  disputeUpdates: z.boolean().optional(),
  returnUpdates: z.boolean().optional(),
  productAnnouncements: z.boolean().optional(),
  sellerProductUpdates: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "Provide at least one preference value.",
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, preferences] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { marketingOptIn: true },
    }),
    getEmailPreferences(session.user.id),
  ]);

  return NextResponse.json({
    preferences: {
      marketingOptIn: Boolean(user?.marketingOptIn),
      ...preferences,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  if (typeof parsed.data.marketingOptIn === "boolean") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { marketingOptIn: parsed.data.marketingOptIn },
    });
  }

  const preferences = await setEmailPreferences(session.user.id, {
    ...(typeof parsed.data.accountUpdates === "boolean" ? { accountUpdates: parsed.data.accountUpdates } : {}),
    ...(typeof parsed.data.orderUpdates === "boolean" ? { orderUpdates: parsed.data.orderUpdates } : {}),
    ...(typeof parsed.data.disputeUpdates === "boolean" ? { disputeUpdates: parsed.data.disputeUpdates } : {}),
    ...(typeof parsed.data.returnUpdates === "boolean" ? { returnUpdates: parsed.data.returnUpdates } : {}),
    ...(typeof parsed.data.productAnnouncements === "boolean" ? { productAnnouncements: parsed.data.productAnnouncements } : {}),
    ...(typeof parsed.data.sellerProductUpdates === "boolean"
      ? { sellerProductUpdates: parsed.data.sellerProductUpdates }
      : {}),
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { marketingOptIn: true },
  });

  return NextResponse.json({
    preferences: {
      marketingOptIn: Boolean(user?.marketingOptIn),
      ...preferences,
    },
  });
}
