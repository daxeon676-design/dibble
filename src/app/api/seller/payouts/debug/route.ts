import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getSellerStripeAccountId } from "@/lib/site-config";

// Diagnostic-only endpoint. Returns raw Stripe state for the authenticated seller.
// Remove or gate behind admin flag before going to production.
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role | undefined;
  if (role !== Role.SELLER && role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sellerId = session.user.id;

  const keyRaw = process.env.STRIPE_SECRET_KEY ?? "(not set)";
  const keyStatus = !keyRaw || keyRaw === "(not set)"
    ? "missing"
    : keyRaw.includes("change_me")
    ? "placeholder (change_me)"
    : keyRaw.startsWith("sk_test_")
    ? `test key (${keyRaw.slice(0, 14)}...)`
    : keyRaw.startsWith("sk_live_")
    ? `live key (${keyRaw.slice(0, 14)}...)`
    : `unknown format (${keyRaw.slice(0, 10)}...)`;

  const stripeStatus = stripe ? "initialised" : "null (key rejected)";

  const storedAccountId = await getSellerStripeAccountId(sellerId).catch((e: unknown) => `ERROR: ${String(e)}`);

  let accountRetrieve: unknown = null;
  if (stripe && storedAccountId && !String(storedAccountId).startsWith("ERROR")) {
    try {
      accountRetrieve = await stripe.accounts.retrieve(storedAccountId as string);
    } catch (e: unknown) {
      accountRetrieve = { retrieveError: e instanceof Error ? e.message : String(e) };
    }
  }

  let onboardingLink: unknown = null;
  if (stripe && storedAccountId && !String(storedAccountId).startsWith("ERROR")) {
    try {
      onboardingLink = await stripe.accountLinks.create({
        account: storedAccountId as string,
        type: "account_onboarding",
        refresh_url: "https://example.com/refresh",
        return_url: "https://example.com/return",
      });
    } catch (e: unknown) {
      onboardingLink = { linkError: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json({
    routeVersion: "payouts-debug-2026-03-30-1",
    sellerId,
    keyStatus,
    stripeStatus,
    storedAccountId,
    accountRetrieve,
    onboardingLink,
  });
}
