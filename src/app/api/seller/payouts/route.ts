import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";
import {
  getSellerPayoutProfile,
  getSellerStripeAccountId,
  setSellerPayoutProfile,
  setSellerStripeAccountId,
} from "@/lib/site-config";

const updateProfileSchema = z
  .object({
    method: z.enum(["STRIPE_CONNECT", "BANK_TRANSFER", "PAYPAL", "MANUAL_REVIEW"]).optional(),
    payeeName: z.string().max(120).optional(),
    payoutEmail: z.string().email().max(160).optional().or(z.literal("")),
    bankName: z.string().max(120).optional(),
    bankAccountLast4: z.string().regex(/^\d{0,4}$/).optional(),
    bankSortCodeLast2: z.string().regex(/^\d{0,2}$/).optional(),
    paypalEmail: z.string().email().max(160).optional().or(z.literal("")),
    notes: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    const method = value.method;
    if (!method) {
      return;
    }

    if (method === "BANK_TRANSFER") {
      if (!value.payeeName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payeeName"], message: "Payee name is required for bank transfer." });
      }
      if (!value.bankName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankName"], message: "Bank name is required for bank transfer." });
      }
      if ((value.bankAccountLast4?.trim() ?? "").length !== 4) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankAccountLast4"], message: "Bank account last 4 digits are required." });
      }
      if ((value.bankSortCodeLast2?.trim() ?? "").length !== 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankSortCodeLast2"], message: "Sort code last 2 digits are required." });
      }
    }

    if (method === "PAYPAL") {
      if (!value.payeeName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payeeName"], message: "Payee name is required for PayPal payouts." });
      }
      if (!value.paypalEmail?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paypalEmail"], message: "PayPal email is required for PayPal payouts." });
      }
    }

    if (method === "MANUAL_REVIEW") {
      if (!value.notes?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["notes"], message: "Please provide notes for manual review payouts." });
      }
    }
  });

type SellerRouteSession = {
  user?: {
    id?: string;
    role?: Role;
  };
} | null;

function requireSellerRole(session: SellerRouteSession) {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.SELLER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

async function getSellerAccountStatus(sellerId: string) {
  const accountId = await getSellerStripeAccountId(sellerId);

  if (!stripe) {
    return {
      stripeEnabled: false,
      hasConnectAccount: Boolean(accountId),
      accountId,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingComplete: false,
      detailsSubmitted: false,
      dashboardUrl: null as string | null,
    };
  }

  if (!accountId) {
    return {
      stripeEnabled: true,
      hasConnectAccount: false,
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingComplete: false,
      detailsSubmitted: false,
      dashboardUrl: null as string | null,
    };
  }

  const account = await stripe.accounts.retrieve(accountId);

  return {
    stripeEnabled: true,
    hasConnectAccount: true,
    accountId,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    onboardingComplete: Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    dashboardUrl: null as string | null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const authError = requireSellerRole(session);
  if (authError) return authError;

  const [status, payoutProfile] = await Promise.all([
    getSellerAccountStatus(session!.user.id),
    getSellerPayoutProfile(session!.user.id),
  ]);

  return NextResponse.json({ ...status, payoutProfile });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const authError = requireSellerRole(session);
  if (authError) return authError;

  const rateLimit = checkRateLimit(request, {
    scope: "seller-payouts-write",
    limit: 90,
    windowMs: 60_000,
    key: `seller:${session!.user.id}`,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many payout requests. Please retry shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | ({ action?: string } & Record<string, unknown>)
    | null;
  const action = body?.action ?? "start_onboarding";

  const sellerId = session!.user.id;

  if (action === "update_profile") {
    const parsed = updateProfileSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payout profile details.",
          fields: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const cleaned = {
      method: parsed.data.method,
      payeeName: parsed.data.payeeName?.trim() || undefined,
      payoutEmail: parsed.data.payoutEmail?.trim() || undefined,
      bankName: parsed.data.bankName?.trim() || undefined,
      bankAccountLast4: parsed.data.bankAccountLast4?.trim() || undefined,
      bankSortCodeLast2: parsed.data.bankSortCodeLast2?.trim() || undefined,
      paypalEmail: parsed.data.paypalEmail?.trim() || undefined,
      notes: parsed.data.notes?.trim() || undefined,
    };

    await setSellerPayoutProfile(sellerId, cleaned);
    const payoutProfile = await getSellerPayoutProfile(sellerId);
    return NextResponse.json({ ok: true, payoutProfile });
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  if (action === "start_onboarding") {
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { email: true, displayName: true },
    });

    let accountId = await getSellerStripeAccountId(sellerId);

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        email: seller?.email ?? undefined,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          sellerId,
          sellerName: seller?.displayName ?? seller?.email ?? "",
        },
      });

      accountId = account.id;
      await setSellerStripeAccountId(sellerId, account.id);
    }

    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${appUrl}/seller?payouts=retry`,
      return_url: `${appUrl}/seller?payouts=done`,
    });

    return NextResponse.json({ url: accountLink.url, accountId });
  }

  if (action === "open_dashboard") {
    const accountId = await getSellerStripeAccountId(sellerId);
    if (!accountId) {
      return NextResponse.json({ error: "Seller payout account is not configured." }, { status: 409 });
    }

    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return NextResponse.json({ url: loginLink.url, accountId });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
