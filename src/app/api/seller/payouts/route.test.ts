import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetSellerPayoutProfile = vi.fn();
const mockSetSellerPayoutProfile = vi.fn();
const mockGetSellerStripeAccountId = vi.fn();
const mockSetSellerStripeAccountId = vi.fn();
const mockUserFindUnique = vi.fn();
const mockStripeAccountsCreate = vi.fn();
const mockStripeAccountsRetrieve = vi.fn();
const mockStripeAccountsCreateLoginLink = vi.fn();
const mockStripeAccountLinksCreate = vi.fn();

let mockStripe: {
  accounts: {
    create: typeof mockStripeAccountsCreate;
    retrieve: typeof mockStripeAccountsRetrieve;
    createLoginLink: typeof mockStripeAccountsCreateLoginLink;
  };
  accountLinks: {
    create: typeof mockStripeAccountLinksCreate;
  };
} | null = null;

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/site-config", () => ({
  getSellerPayoutProfile: mockGetSellerPayoutProfile,
  getSellerStripeAccountId: mockGetSellerStripeAccountId,
  setSellerPayoutProfile: mockSetSellerPayoutProfile,
  setSellerStripeAccountId: mockSetSellerStripeAccountId,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  get stripe() {
    return mockStripe;
  },
}));

describe("seller payout profile validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1", role: "SELLER" } });
    mockCheckRateLimit.mockReturnValue({ ok: true, retryAfterSeconds: 0 });
    mockGetSellerPayoutProfile.mockResolvedValue({});
    mockGetSellerStripeAccountId.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue(null);
    mockStripeAccountsRetrieve.mockReset();
    mockStripeAccountsCreateLoginLink.mockReset();
    mockStripe = null;
  });

  it("rejects bank transfer profiles without required bank details", async () => {
    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          method: "BANK_TRANSFER",
          payeeName: "",
          bankName: "",
          bankAccountLast4: "12",
          bankSortCodeLast2: "",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; fields: { fieldErrors: Record<string, string[]> } };
    expect(body.error).toBe("Invalid payout profile details.");
    expect(body.fields.fieldErrors.payeeName?.[0]).toContain("Payee name is required");
    expect(body.fields.fieldErrors.bankName?.[0]).toContain("Bank name is required");
    expect(body.fields.fieldErrors.bankAccountLast4?.[0]).toContain("Bank account last 4 digits are required");
    expect(body.fields.fieldErrors.bankSortCodeLast2?.[0]).toContain("Sort code last 2 digits are required");
    expect(mockSetSellerPayoutProfile).not.toHaveBeenCalled();
  });

  it("rejects PayPal profiles without payee name and paypal email", async () => {
    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          method: "PAYPAL",
          payeeName: "",
          paypalEmail: "",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { fields: { fieldErrors: Record<string, string[]> } };
    expect(body.fields.fieldErrors.payeeName?.[0]).toContain("Payee name is required");
    expect(body.fields.fieldErrors.paypalEmail?.[0]).toContain("PayPal email is required");
    expect(mockSetSellerPayoutProfile).not.toHaveBeenCalled();
  });

  it("rejects manual review profiles without notes", async () => {
    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          method: "MANUAL_REVIEW",
          notes: "",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { fields: { fieldErrors: Record<string, string[]> } };
    expect(body.fields.fieldErrors.notes?.[0]).toContain("Please provide notes for manual review payouts.");
  });

  it("accepts a valid bank transfer profile and persists trimmed values", async () => {
    mockGetSellerPayoutProfile.mockResolvedValueOnce({
      method: "BANK_TRANSFER",
      payeeName: "Alice Seller",
    });

    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          method: "BANK_TRANSFER",
          payeeName: " Alice Seller ",
          payoutEmail: "accounts@example.com",
          bankName: " Example Bank ",
          bankAccountLast4: "1234",
          bankSortCodeLast2: "56",
          notes: " weekly payouts ",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockSetSellerPayoutProfile).toHaveBeenCalledWith("seller-1", {
      method: "BANK_TRANSFER",
      payeeName: "Alice Seller",
      payoutEmail: "accounts@example.com",
      bankName: "Example Bank",
      bankAccountLast4: "1234",
      bankSortCodeLast2: "56",
      paypalEmail: undefined,
      notes: "weekly payouts",
    });
  });

  it("returns a 503 when Stripe is not configured for onboarding", async () => {
    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_onboarding" }),
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "Stripe is not configured." });
  });

  it("creates an onboarding link using the forwarded request origin", async () => {
    mockStripe = {
      accounts: {
        create: mockStripeAccountsCreate.mockResolvedValue({ id: "acct_123" }),
        retrieve: mockStripeAccountsRetrieve,
        createLoginLink: mockStripeAccountsCreateLoginLink,
      },
      accountLinks: {
        create: mockStripeAccountLinksCreate.mockResolvedValue({ url: "https://connect.stripe.test/onboard" }),
      },
    };
    mockUserFindUnique.mockResolvedValue({ email: "seller@example.com", displayName: "Alice Seller" });

    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("https://dibble.example/api/seller/payouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "dibble.example",
        },
        body: JSON.stringify({ action: "start_onboarding" }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://connect.stripe.test/onboard", accountId: "acct_123" });
    expect(mockStripeAccountsCreate).toHaveBeenCalledWith({
      type: "express",
      country: "GB",
      email: "seller@example.com",
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        sellerId: "seller-1",
        sellerName: "Alice Seller",
      },
    });
    expect(mockSetSellerStripeAccountId).toHaveBeenCalledWith("seller-1", "acct_123");
    expect(mockStripeAccountLinksCreate).toHaveBeenCalledWith({
      account: "acct_123",
      type: "account_onboarding",
      refresh_url: "https://dibble.example/seller?payouts=retry",
      return_url: "https://dibble.example/seller?payouts=done",
    });
  });

  it("surfaces Stripe onboarding link creation failures", async () => {
    mockStripe = {
      accounts: {
        create: mockStripeAccountsCreate,
        retrieve: mockStripeAccountsRetrieve,
        createLoginLink: mockStripeAccountsCreateLoginLink,
      },
      accountLinks: {
        create: mockStripeAccountLinksCreate.mockRejectedValue(new Error("Stripe rejected the return URL.")),
      },
    };
    mockGetSellerStripeAccountId.mockResolvedValue("acct_existing");

    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_onboarding" }),
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Stripe rejected the return URL. [payouts-route-2026-03-30-3]" });
    expect(mockStripeAccountsCreate).toHaveBeenCalledTimes(1);
  });

  it("replaces a stale stored Stripe account before creating onboarding", async () => {
    mockStripe = {
      accounts: {
        create: mockStripeAccountsCreate.mockResolvedValue({ id: "acct_fresh" }),
        retrieve: mockStripeAccountsRetrieve.mockRejectedValue(Object.assign(new Error("No such account: 'acct_stale'"), { code: "resource_missing" })),
        createLoginLink: mockStripeAccountsCreateLoginLink,
      },
      accountLinks: {
        create: mockStripeAccountLinksCreate.mockResolvedValue({ url: "https://connect.stripe.test/fresh" }),
      },
    };
    mockGetSellerStripeAccountId.mockResolvedValue("acct_stale");
    mockUserFindUnique.mockResolvedValue({ email: "seller@example.com", displayName: "Alice Seller" });

    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_onboarding" }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://connect.stripe.test/fresh", accountId: "acct_fresh" });
    expect(mockSetSellerStripeAccountId).toHaveBeenNthCalledWith(1, "seller-1", null);
    expect(mockSetSellerStripeAccountId).toHaveBeenNthCalledWith(2, "seller-1", "acct_fresh");
  });

  it("falls back to onboarding when dashboard is opened before details are submitted", async () => {
    mockStripe = {
      accounts: {
        create: mockStripeAccountsCreate,
        retrieve: mockStripeAccountsRetrieve.mockResolvedValue({ details_submitted: false }),
        createLoginLink: mockStripeAccountsCreateLoginLink,
      },
      accountLinks: {
        create: mockStripeAccountLinksCreate.mockResolvedValue({ url: "https://connect.stripe.test/continue" }),
      },
    };
    mockGetSellerStripeAccountId.mockResolvedValue("acct_existing");

    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_dashboard" }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://connect.stripe.test/continue", accountId: "acct_existing" });
    expect(mockStripeAccountsCreateLoginLink).not.toHaveBeenCalled();
  });

  it("creates a Stripe login link for completed accounts", async () => {
    mockStripe = {
      accounts: {
        create: mockStripeAccountsCreate,
        retrieve: mockStripeAccountsRetrieve.mockResolvedValue({ details_submitted: true }),
        createLoginLink: mockStripeAccountsCreateLoginLink.mockResolvedValue({ url: "https://connect.stripe.test/dashboard" }),
      },
      accountLinks: {
        create: mockStripeAccountLinksCreate,
      },
    };
    mockGetSellerStripeAccountId.mockResolvedValue("acct_existing");

    const { POST } = await import("@/app/api/seller/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_dashboard" }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://connect.stripe.test/dashboard", accountId: "acct_existing" });
    expect(mockStripeAccountsCreateLoginLink).toHaveBeenCalledWith("acct_existing");
  });
});
