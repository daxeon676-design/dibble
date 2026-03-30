import { generateSecret, generateURI, verify } from "otplib";
import { toDataURL } from "qrcode";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

const APP_NAME = "Dibble";

/**
 * GET /api/auth/mfa/setup
 * Returns a fresh TOTP secret and QR-code data URL for the authenticated admin.
 * The secret is NOT yet persisted — the admin must verify a code first (POST).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: APP_NAME,
    label: session.user.email ?? session.user.id,
    secret,
  });
  const qrCode = await toDataURL(otpauthUrl);

  return NextResponse.json({ secret, qrCode });
}

/**
 * POST /api/auth/mfa/setup
 * Body: { code: string, secret: string }
 * Verifies the TOTP code against the provided secret. On success, persists the
 * secret and sets mfaEnabled = true for the authenticated admin.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: unknown; secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : null;
  const secret = typeof body.secret === "string" ? body.secret.trim() : null;

  if (!code || !secret) {
    return NextResponse.json({ error: "code and secret are required" }, { status: 400 });
  }

  const verification = await verify({ token: code, secret });
  if (!verification.valid) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 422 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: true, mfaSecret: secret },
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/auth/mfa/setup
 * Disables MFA for the authenticated admin. Only allowed when at least one
 * other active admin still has MFA enabled, to prevent locking out all admins.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === Role.ADMIN) {
    const otherMfaAdmins = await prisma.user.count({
      where: {
        role: Role.ADMIN,
        mfaEnabled: true,
        id: { not: session.user.id },
      },
    });

    if (otherMfaAdmins === 0) {
      return NextResponse.json(
        { error: "Cannot disable MFA — you are the only admin with MFA enabled" },
        { status: 409 }
      );
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  return NextResponse.json({ ok: true });
}
