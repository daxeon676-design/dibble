import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetSellerPayoutProfile = vi.fn();
const mockSetSellerPayoutProfile = vi.fn();

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
  getSellerStripeAccountId: vi.fn().mockResolvedValue(null),
  setSellerPayoutProfile: mockSetSellerPayoutProfile,
  setSellerStripeAccountId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: null,
}));

describe("seller payout profile validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "seller-1", role: "SELLER" } });
    mockCheckRateLimit.mockReturnValue({ ok: true, retryAfterSeconds: 0 });
    mockGetSellerPayoutProfile.mockResolvedValue({});
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
});
