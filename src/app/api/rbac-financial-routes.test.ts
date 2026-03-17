import { describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(1),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ ok: true, retryAfterSeconds: 0 })),
}));

vi.mock("@/lib/seller-payout-ledger", () => ({
  listSellerPayouts: vi.fn().mockResolvedValue([]),
  markSellerPayoutPaid: vi.fn(),
  markSellerPayoutPaidWithTransfer: vi.fn(),
}));

vi.mock("@/lib/site-config", () => ({
  getSellerPayoutProfile: vi.fn().mockResolvedValue(null),
  getSellerStripeAccountId: vi.fn().mockResolvedValue(null),
  setSellerPayoutProfile: vi.fn(),
  setSellerStripeAccountId: vi.fn(),
}));

vi.mock("@/lib/ops-alert-dispatcher", () => ({
  dispatchOpsAlert: vi.fn().mockResolvedValue({ delivered: false, reason: "missing_destination" }),
}));

describe("RBAC financial endpoints", () => {
  it("blocks unauthenticated access to admin payouts list", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/admin/payouts/route");

    const res = await GET(new Request("http://localhost/api/admin/payouts"));
    expect(res.status).toBe(403);
  });

  it("blocks non-admin access to admin payouts writes", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "seller-1", role: "SELLER" } });
    const { POST } = await import("@/app/api/admin/payouts/route");

    const res = await POST(
      new Request("http://localhost/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "ord_1" }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("blocks unauthenticated access to seller payouts", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/seller/payouts/route");

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("blocks buyer role from seller payouts", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "buyer-1", role: "BUYER" } });
    const { GET } = await import("@/app/api/seller/payouts/route");

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("blocks non-admin access to launch readiness endpoint", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "seller-1", role: "SELLER" } });
    const { GET } = await import("@/app/api/admin/launch-readiness/route");

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("blocks non-admin access to test alert dispatch endpoint", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "seller-1", role: "SELLER" } });
    const { POST } = await import("@/app/api/admin/ops-alerts/test/route");

    const res = await POST();
    expect(res.status).toBe(403);
  });
});