import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConstructEvent = vi.fn();
const mockFinalizeOrderPayment = vi.fn();
const mockLogApiEvent = vi.fn();
const mockStripeWebhookEventCreate = vi.fn();
const mockStripeWebhookEventFindUnique = vi.fn();
const mockStripeWebhookEventUpdate = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  },
}));

vi.mock("@/lib/payment-finalizer", () => ({
  finalizeOrderPayment: mockFinalizeOrderPayment,
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: mockLogApiEvent,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stripeWebhookEvent: {
      create: mockStripeWebhookEventCreate,
      findUnique: mockStripeWebhookEventFindUnique,
      update: mockStripeWebhookEventUpdate,
    },
  },
}));

describe("Stripe webhook route idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("returns duplicate when the event was already processed", async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: "evt_processed",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123", metadata: { orderId: "ord_1" } } },
    });
    mockStripeWebhookEventCreate.mockRejectedValueOnce(new Error("duplicate"));
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({
      eventId: "evt_processed",
      status: "PROCESSED",
      updatedAt: new Date(),
    });

    const { POST } = await import("@/app/api/payments/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ received: true, duplicate: true, processed: true });
    expect(mockFinalizeOrderPayment).not.toHaveBeenCalled();
  });

  it("skips a fresh PROCESSING event replay", async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: "evt_processing",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_123", metadata: { orderId: "ord_1" } } },
    });
    mockStripeWebhookEventCreate.mockRejectedValueOnce(new Error("duplicate"));
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({
      eventId: "evt_processing",
      status: "PROCESSING",
      updatedAt: new Date(),
    });

    const { POST } = await import("@/app/api/payments/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ received: true, duplicate: true, processed: false });
    expect(mockStripeWebhookEventUpdate).not.toHaveBeenCalled();
    expect(mockFinalizeOrderPayment).not.toHaveBeenCalled();
  });

  it("recovers a stale PROCESSING event and completes processing", async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: "evt_stale",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_stale", metadata: { orderId: "ord_stale" } } },
    });
    mockStripeWebhookEventCreate.mockRejectedValueOnce(new Error("duplicate"));
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({
      eventId: "evt_stale",
      status: "PROCESSING",
      updatedAt: new Date(Date.now() - 11 * 60 * 1000),
    });
    mockFinalizeOrderPayment.mockResolvedValueOnce({ updated: true });
    mockStripeWebhookEventUpdate.mockResolvedValue({});

    const { POST } = await import("@/app/api/payments/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    expect(mockStripeWebhookEventUpdate).toHaveBeenNthCalledWith(1, {
      where: { eventId: "evt_stale" },
      data: {
        status: "PROCESSING",
        lastError: null,
        eventType: "payment_intent.succeeded",
        attemptCount: { increment: 1 },
      },
    });
    expect(mockFinalizeOrderPayment).toHaveBeenCalledWith("ord_stale", "pi_stale", "SUCCEEDED");
    expect(mockStripeWebhookEventUpdate).toHaveBeenNthCalledWith(2, {
      where: { eventId: "evt_stale" },
      data: {
        status: "PROCESSED",
        processedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it("retries a previously failed event and marks it processed", async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: "evt_failed",
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_failed", metadata: { orderId: "ord_failed" } } },
    });
    mockStripeWebhookEventCreate.mockRejectedValueOnce(new Error("duplicate"));
    mockStripeWebhookEventFindUnique.mockResolvedValueOnce({
      eventId: "evt_failed",
      status: "FAILED",
      updatedAt: new Date(),
    });
    mockFinalizeOrderPayment.mockResolvedValueOnce({ updated: true });
    mockStripeWebhookEventUpdate.mockResolvedValue({});

    const { POST } = await import("@/app/api/payments/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    expect(mockFinalizeOrderPayment).toHaveBeenCalledWith("ord_failed", "pi_failed", "FAILED");
    expect(mockStripeWebhookEventUpdate).toHaveBeenNthCalledWith(1, {
      where: { eventId: "evt_failed" },
      data: {
        status: "PROCESSING",
        lastError: null,
        eventType: "payment_intent.payment_failed",
        attemptCount: { increment: 1 },
      },
    });
  });

  it("marks the webhook event failed when processing throws", async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: "evt_error",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_error", metadata: { orderId: "ord_error" } } },
    });
    mockStripeWebhookEventCreate.mockResolvedValueOnce({});
    mockFinalizeOrderPayment.mockRejectedValueOnce(new Error("boom"));
    mockStripeWebhookEventUpdate.mockResolvedValue({});

    const { POST } = await import("@/app/api/payments/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: "{}",
      }),
    );

    expect(res.status).toBe(500);
    expect(mockStripeWebhookEventUpdate).toHaveBeenCalledWith({
      where: { eventId: "evt_error" },
      data: {
        status: "FAILED",
        lastError: "boom",
      },
    });
  });
});
