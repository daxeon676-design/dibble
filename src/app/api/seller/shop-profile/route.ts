import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { getSellerShopProfile, setSellerShopProfile } from "@/lib/site-config";

const optionalUrl = z.string().url().max(300).optional().or(z.literal(""));

const shopProfileSchema = z.object({
  headline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(1200).optional(),
  logoUrl: z.string().url().max(500).optional().or(z.string().startsWith("/uploads/")).or(z.literal("")),
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  websiteUrl: optionalUrl,
  localDiscoveryEnabled: z.boolean().optional(),
  localDiscoveryLocation: z.string().trim().max(120).optional(),
  localDiscoveryRadiusMiles: z.number().int().min(0).max(200).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await getSellerShopProfile(session.user.id);
  return NextResponse.json(profile);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = shopProfileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid shop profile payload." }, { status: 400 });
  }

  const normalized = {
    headline: parsed.data.headline?.trim() || "",
    description: parsed.data.description?.trim() || "",
    logoUrl: parsed.data.logoUrl || "",
    instagramUrl: parsed.data.instagramUrl || "",
    tiktokUrl: parsed.data.tiktokUrl || "",
    websiteUrl: parsed.data.websiteUrl || "",
    localDiscoveryEnabled: Boolean(parsed.data.localDiscoveryEnabled),
    localDiscoveryLocation: parsed.data.localDiscoveryLocation?.trim() || "",
    localDiscoveryRadiusMiles: Math.max(0, parsed.data.localDiscoveryRadiusMiles ?? 0),
  };

  await setSellerShopProfile(session.user.id, normalized);

  return NextResponse.json(normalized);
}