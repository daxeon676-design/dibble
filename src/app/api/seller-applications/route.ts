import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role, SellerApplicationStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { verifyTurnstileToken } from "@/lib/human-verification";
import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config";
import { checkRateLimit } from "@/lib/rate-limit";

const createApplicationSchema = z.object({
  shopName: z.string().trim().min(3).max(80),
  description: z.string().trim().min(20).max(1000),
  businessType: z.enum(["sole_trader", "limited_company", "partnership", "individual"]),
  businessAddress: z.string().trim().min(5).max(300),
  vatNumber: z.string().trim().max(20).optional(),
  planToSell: z.string().trim().min(10).max(500),
  sellerTermsAccepted: z.literal(true, { error: "You must accept the Seller Terms & Conditions." }),
  confirmedAdult: z.literal(true, { error: "You must confirm you are 18 or older." }),
  humanVerificationToken: z.string().min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await prisma.sellerApplication.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      shopName: true,
      description: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNotes: true,
    },
  });

  const siteConfig = await getSiteConfig();
  const activeSellerCount = await prisma.user.count({ where: { role: Role.SELLER } });

  return NextResponse.json({
    application,
    applicationConfig: {
      allowNewSellerApplications: siteConfig.allowNewSellerApplications,
      maxActiveSellerAccounts: siteConfig.maxActiveSellerAccounts,
      activeSellerCount,
      capacityReached: activeSellerCount >= siteConfig.maxActiveSellerAccounts,
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    scope: "seller-application-submit",
    limit: 5,
    windowMs: 15 * 60 * 1000,
    key: session.user.id,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many application attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  if (session.user.role !== Role.BUYER) {
    return NextResponse.json(
      { error: "Only buyers can submit seller applications." },
      { status: 403 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createApplicationSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid application payload." }, { status: 400 });
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

  const existing = await prisma.sellerApplication.findUnique({ where: { userId: session.user.id } });
  if (existing) {
    return NextResponse.json({ error: "You already submitted a seller application." }, { status: 409 });
  }

  const siteConfig = await getSiteConfig();
  if (!siteConfig.allowNewSellerApplications) {
    return NextResponse.json({ error: "Seller applications are currently paused." }, { status: 409 });
  }

  const activeSellerCount = await prisma.user.count({ where: { role: Role.SELLER } });
  if (activeSellerCount >= siteConfig.maxActiveSellerAccounts) {
    return NextResponse.json(
      { error: "Seller capacity reached. Applications are temporarily closed." },
      { status: 409 },
    );
  }

  try {
    const application = await prisma.sellerApplication.create({
      data: {
        userId: session.user.id,
        shopName: parsed.data.shopName,
        description: parsed.data.description,
        businessType: parsed.data.businessType,
        businessAddress: parsed.data.businessAddress,
        vatNumber: parsed.data.vatNumber,
        planToSell: parsed.data.planToSell,
        sellerTermsAcceptedAt: new Date(),
        confirmedAdult: true,
        status: SellerApplicationStatus.PENDING,
      },
      select: {
        id: true,
        shopName: true,
        status: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to submit application. Shop name may already be in use." },
      { status: 409 },
    );
  }
}
