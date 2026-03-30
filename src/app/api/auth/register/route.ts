import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role, UserStatus } from "@/generated/prisma/enums";
import { appBaseUrl } from "@/lib/email";
import { sendPreferenceAwareEmail } from "@/lib/preference-email";
import { verifyTurnstileToken } from "@/lib/human-verification";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(2).max(80).optional(),
  humanVerificationToken: z.string().min(1),
  termsAccepted: z.literal(true, { error: "You must accept the Terms & Conditions." }),
  marketingOptIn: z.boolean().optional(),
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

  if (!process.env.TURNSTILE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Human verification is not configured. Please try again later." },
      { status: 503 },
    );
  }

  const isHuman = await verifyTurnstileToken(request, parsed.data.humanVerificationToken);
  if (!isHuman) {
    return NextResponse.json({ error: "Human verification failed. Please try again." }, { status: 400 });
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
      termsAcceptedAt: new Date(),
      marketingOptIn: parsed.data.marketingOptIn ?? false,
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const displayName = parsed.data.displayName?.trim() || user.email;
  void sendPreferenceAwareEmail({
    userId: user.id,
    preferenceKey: "accountUpdates",
    to: user.email,
    subject: "Welcome to Dibble",
    html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="margin-bottom:8px">Welcome to Dibble</h2>
          <p>Hi ${displayName},</p>
          <p>Your account has been created successfully.</p>
          <p style="margin:20px 0">
            <a href="${appBaseUrl()}/buyer/marketplace"
               style="background:#2d5a27;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
              Start browsing
            </a>
          </p>
          <p style="color:#666">You can also apply to become a seller once signed in.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#999;font-size:12px">Dibble Marketplace</p>
        </div>
      `,
  });

  return NextResponse.json({ user }, { status: 201 });
}
