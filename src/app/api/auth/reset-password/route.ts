import bcrypt from "bcrypt";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestId, logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  const rateLimit = checkRateLimit(request, {
    scope: "reset-password",
    limit: 10,
    windowMs: 15 * 60_000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, status: true } } },
  });

  if (!record) {
    logApiEvent("warn", "auth.reset_password.invalid_token", { requestId });
    return NextResponse.json({ error: "This reset link is invalid or has already been used." }, { status: 400 });
  }

  if (record.usedAt) {
    return NextResponse.json({ error: "This reset link has already been used." }, { status: 400 });
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  logApiEvent("info", "auth.reset_password.success", { requestId, userId: record.userId });
  return NextResponse.json({ ok: true });
}
