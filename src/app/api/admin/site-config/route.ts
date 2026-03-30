import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getSiteConfig, saveSiteConfig, appendConfigHistory } from "@/lib/site-config";

const deliveryOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  costPence: z.number().int().min(0),
  enabled: z.boolean(),
});

const pendingChangeSchema = z.object({
  value: z.number(),
  effectiveAt: z.string().datetime(),
}).nullable();

const siteConfigSchema = z.object({
  categories: z.array(z.string().min(1)),
  deliveryOptions: z.array(deliveryOptionSchema),
  homepageTagline: z.string().min(1),
  footerDescription: z.string().min(1),
  platformFeePercent: z.number().min(0).max(100),
  supportEmail: z.string().email(),
  allowNewSellerApplications: z.boolean(),
  maxActiveSellerAccounts: z.number().int().min(1).max(10000),
  maintenanceMode: z.boolean().default(false),
  checkoutPaused: z.boolean().default(false),
  newAccountsPaused: z.boolean().default(false),
  pendingFeeChange: pendingChangeSchema.default(null),
  pendingSellerLimitChange: pendingChangeSchema.default(null),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getSiteConfig();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = siteConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Snapshot the current config before overwriting (for rollback)
  const previous = await getSiteConfig();
  await appendConfigHistory({
    savedAt: new Date().toISOString(),
    savedBy: session.user.email ?? "unknown",
    config: previous,
  });

  await saveSiteConfig(parsed.data);
  return NextResponse.json({ ok: true });
}
