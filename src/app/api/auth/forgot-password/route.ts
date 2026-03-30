import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { appBaseUrl, sendEmail } from "@/lib/email";
import { getRequestId, logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  const rateLimit = checkRateLimit(request, {
    scope: "forgot-password",
    limit: 5,
    windowMs: 15 * 60_000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Always return 200 to prevent email enumeration.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logApiEvent("info", "auth.forgot_password.user_not_found", { requestId, email });
    return NextResponse.json({ ok: true });
  }

  // Invalidate existing unused tokens for this user.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  // Generate a secure random token.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${appBaseUrl()}/reset-password?token=${rawToken}`;
  const displayName = user.displayName ?? email;

  await sendEmail({
    to: email,
    subject: "Reset your Dibble password",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">Reset your password</h2>
        <p>Hi ${displayName},</p>
        <p>We received a request to reset the password for your Dibble account.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}"
             style="background:#2d5a27;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
        </p>
        <p style="color:#666;font-size:14px">This link expires in <strong>1 hour</strong>.</p>
        <p style="color:#666;font-size:14px">If you didn't request a password reset, you can safely ignore this email — your password has not been changed.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#999;font-size:12px">Dibble Marketplace · dibblemarketplace.com</p>
      </div>
    `,
  });

  logApiEvent("info", "auth.forgot_password.sent", { requestId, userId: user.id });
  return NextResponse.json({ ok: true });
}
