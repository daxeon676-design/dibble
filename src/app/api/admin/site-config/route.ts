import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getSiteConfig, saveSiteConfig } from "@/lib/site-config";

const deliveryOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  costPence: z.number().int().min(0),
  enabled: z.boolean(),
});

const siteConfigSchema = z.object({
  categories: z.array(z.string().min(1)),
  deliveryOptions: z.array(deliveryOptionSchema),
  homepageTagline: z.string().min(1),
  footerDescription: z.string().min(1),
  platformFeePercent: z.number().min(0).max(100),
  supportEmail: z.string().email(),
  allowNewSellerApplications: z.boolean(),
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

  await saveSiteConfig(parsed.data);
  return NextResponse.json({ ok: true });
}
