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

const PAYOUTS_ROUTE_VERSION = "payouts-route-2026-03-30-3";

function withRouteVersion(message: string) {
  return `${message} [${PAYOUTS_ROUTE_VERSION}]`;
}

function resolveAppUrl(request: Request) {
  // Validate each candidate: skip any that are not parseable absolute URLs
  // (guards against quoted values like `"https://..."` in env vars).
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate.trim());
      return parsed.origin;
    } catch {
      // invalid — try next
    }
  }

  // Derive from the incoming request URL (always correct on Vercel/production).
  try {
    return new URL(request.url).origin;
  } catch {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
    return `${proto}://${host}`;
  }
}

function isMissingStripeAccountError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const stripeCode = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (stripeCode === "resource_missing") {
    return true;
  }

  return /no such account|account.*does not exist/i.test(error.message);
}

async function createStripeOnboardingLink(accountId: string, request: Request) {
  const appUrl = resolveAppUrl(request);

  return stripe!.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl}/seller?payouts=retry`,
    return_url: `${appUrl}/seller?payouts=done`,
  });
}

async function createFreshStripeConnectAccount(sellerId: string) {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { email: true, displayName: true },
  });

  const account = await stripe!.accounts.create({
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

  await setSellerStripeAccountId(sellerId, account.id);
  return account;
}

async function createStripeOnboardingLinkWithRecovery(sellerId: string, accountId: string, request: Request) {
  try {
    const link = await createStripeOnboardingLink(accountId, request);
    return { link, accountId };
  } catch {
    const freshAccount = await createFreshStripeConnectAccount(sellerId);
    const link = await createStripeOnboardingLink(freshAccount.id, request);
    return { link, accountId: freshAccount.id };
  }
}

async function getOrCreateStripeConnectAccount(sellerId: string) {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { email: true, displayName: true },
  });

  let accountId = await getSellerStripeAccountId(sellerId);

  if (accountId) {
    try {
      const account = await stripe!.accounts.retrieve(accountId);
      return { accountId, account };
    } catch (error) {
      if (!isMissingStripeAccountError(error)) {
        throw error;
      }

      await setSellerStripeAccountId(sellerId, null);
      accountId = null;
    }
  }

  const account = await stripe!.accounts.create({
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

  await setSellerStripeAccountId(sellerId, account.id);
  return { accountId: account.id, account };
}

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

  let account;
  try {
    account = await stripe.accounts.retrieve(accountId);
  } catch (error) {
    if (!isMissingStripeAccountError(error)) {
      throw error;
    }

    await setSellerStripeAccountId(sellerId, null);
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
  try {
    const session = await getServerSession(authOptions);
    const authError = requireSellerRole(session);
    if (authError) return authError;

    const [status, payoutProfile] = await Promise.all([
      getSellerAccountStatus(session!.user.id),
      getSellerPayoutProfile(session!.user.id),
    ]);

    return NextResponse.json({ ...status, payoutProfile });
  } catch (error) {
    const message = error instanceof Error && error.message.trim()
      ? error.message
      : "Could not load payout status.";
    return NextResponse.json({ error: withRouteVersion(message) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
      try {
        const { accountId } = await getOrCreateStripeConnectAccount(sellerId);
        const { link: accountLink, accountId: activeAccountId } = await createStripeOnboardingLinkWithRecovery(
          sellerId,
          accountId,
          request,
        );

        return NextResponse.json({ url: accountLink.url, accountId: activeAccountId });
      } catch (error) {
        const message = error instanceof Error && error.message.trim()
          ? error.message
          : "Could not create onboarding link.";
        return NextResponse.json({ error: withRouteVersion(message) }, { status: 500 });
      }
    }

    if (action === "open_dashboard") {
      try {
        const { accountId, account } = await getOrCreateStripeConnectAccount(sellerId);

        if (!account.details_submitted) {
          const { link: onboardingLink, accountId: activeAccountId } = await createStripeOnboardingLinkWithRecovery(
            sellerId,
            accountId,
            request,
          );
          return NextResponse.json({ url: onboardingLink.url, accountId: activeAccountId });
        }

        const loginLink = await stripe.accounts.createLoginLink(accountId);
        return NextResponse.json({ url: loginLink.url, accountId });
      } catch (error) {
        const message = error instanceof Error && error.message.trim()
          ? error.message
          : "Could not open Stripe dashboard.";
        return NextResponse.json({ error: withRouteVersion(message) }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error && error.message.trim()
      ? error.message
      : "Could not process payout request.";
    return NextResponse.json({ error: withRouteVersion(message) }, { status: 500 });
  }
}
