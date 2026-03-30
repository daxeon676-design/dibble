import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { sendEmail, appBaseUrl } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.email(),
  requestType: z.enum(["access", "erasure", "portability", "correction", "objection", "withdraw_consent"]),
  details: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    scope: "dsar",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const request_record = await prisma.dsarRequest.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      requestType: parsed.data.requestType,
      details: parsed.data.details,
      userId: session?.user?.id ?? null,
      status: "PENDING",
    },
  });

  // Notify admin
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.EMAIL_FROM ?? "contact@dibblemarketplace.com";
  const base = appBaseUrl();

  await sendEmail({
    to: adminEmail,
    subject: `[Dibble] New DSAR request – ${parsed.data.requestType}`,
    html: `
      <p>A new data subject rights request has been received.</p>
      <table>
        <tr><td><strong>Request ID:</strong></td><td>${request_record.id}</td></tr>
        <tr><td><strong>Type:</strong></td><td>${parsed.data.requestType}</td></tr>
        <tr><td><strong>Email:</strong></td><td>${parsed.data.email}</td></tr>
        <tr><td><strong>User ID:</strong></td><td>${session?.user?.id ?? "Not logged in"}</td></tr>
        <tr><td><strong>Details:</strong></td><td>${parsed.data.details ?? "None"}</td></tr>
        <tr><td><strong>Submitted at:</strong></td><td>${new Date().toISOString()}</td></tr>
      </table>
      <p>Under UK GDPR you must respond within <strong>30 days</strong>. Log in to <a href="${base}/admin">Admin</a> to manage this request.</p>
    `,
  });

  return NextResponse.json({ ok: true, id: request_record.id }, { status: 201 });
}
