import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserModerationFlags, setUserModerationFlag } from "@/lib/user-moderation-flags";

const schema = z.object({
  flagged: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
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

  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot modify your own moderation flag." }, { status: 409 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const next = await setUserModerationFlag({
    userId,
    flagged: parsed.data.flagged,
    reason: parsed.data.reason,
    updatedById: session.user.id,
  });

  await prisma.auditLog.create({
    data: {
      actorAdmin: session.user.id,
      action: "USER_MODERATION_FLAG_UPDATED",
      targetType: "User",
      targetId: userId,
      details: JSON.stringify({
        flagged: next.flagged,
        reason: next.reason,
      }),
    },
  });

  return NextResponse.json({
    flagged: next.flagged,
    reason: next.reason,
    updatedAt: next.updatedAt,
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;
  const flags = await getUserModerationFlags();
  const entry = flags[userId] ?? null;

  return NextResponse.json({ flag: entry });
}
