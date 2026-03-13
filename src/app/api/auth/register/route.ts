import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role, UserStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(2).max(80).optional(),
});

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    scope: "auth-register",
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration payload." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email is already registered." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: parsed.data.displayName,
      role: Role.BUYER,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
