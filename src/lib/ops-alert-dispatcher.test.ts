import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSaveOpsAlertDeliveryStatus = vi.fn();

vi.mock("@/lib/ops-alert-delivery-store", () => ({
  saveOpsAlertDeliveryStatus: mockSaveOpsAlertDeliveryStatus,
}));

describe("dispatchOpsAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPS_ALERT_WEBHOOK_URL;
    delete process.env.OPS_ALERT_WEBHOOK_BEARER_TOKEN;
  });

  it("records missing destination when webhook is not configured", async () => {
    const { dispatchOpsAlert } = await import("@/lib/ops-alert-dispatcher");
    const result = await dispatchOpsAlert({
      source: "cron",
      severity: "critical",
      title: "Test",
      message: "Missing destination",
    });

    expect(result.delivered).toBe(false);
    expect(mockSaveOpsAlertDeliveryStatus).toHaveBeenCalled();
    expect(result).toMatchObject({ reason: "missing_destination" });
  });

  it("posts to webhook when configured", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://example.test/hooks/ops";
    process.env.OPS_ALERT_WEBHOOK_BEARER_TOKEN = "token123";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { dispatchOpsAlert } = await import("@/lib/ops-alert-dispatcher");
    const result = await dispatchOpsAlert({
      source: "admin_api",
      severity: "warn",
      title: "Test",
      message: "Webhook call",
      context: { issues: 2 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.delivered).toBe(true);
    vi.unstubAllGlobals();
  });
});
