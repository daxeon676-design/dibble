import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  choice: z.enum(["accepted", "rejected"]),
  version: z.string().min(1).max(20),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  const ipHash = ip ? createHash("sha256").update(ip).digest("hex") : null;

  await prisma.cookieConsentLog.create({
    data: {
      userId: session?.user?.id ?? null,
      choice: parsed.data.choice,
      version: parsed.data.version,
      ipHash,
    },
  });

  return NextResponse.json({ ok: true });
}
