import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendEmail = vi.fn();
const mockIsEmailPreferenceEnabled = vi.fn();

vi.mock("@/lib/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("@/lib/email-preferences", () => ({
  isEmailPreferenceEnabled: mockIsEmailPreferenceEnabled,
}));

describe("sendPreferenceAwareEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email when the preference is enabled", async () => {
    mockIsEmailPreferenceEnabled.mockResolvedValue(true);
    mockSendEmail.mockResolvedValue(true);

    const { sendPreferenceAwareEmail } = await import("@/lib/preference-email");
    const result = await sendPreferenceAwareEmail({
      userId: "user-1",
      preferenceKey: "orderUpdates",
      to: "buyer@example.com",
      subject: "Order update",
      html: "<p>Hi</p>",
    });

    expect(result).toBe(true);
    expect(mockIsEmailPreferenceEnabled).toHaveBeenCalledWith("user-1", "orderUpdates");
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: "buyer@example.com",
      subject: "Order update",
      html: "<p>Hi</p>",
    });
  });

  it("skips email when the preference is disabled", async () => {
    mockIsEmailPreferenceEnabled.mockResolvedValue(false);

    const { sendPreferenceAwareEmail } = await import("@/lib/preference-email");
    const result = await sendPreferenceAwareEmail({
      userId: "user-2",
      preferenceKey: "productAnnouncements",
      to: "buyer@example.com",
      subject: "New product",
      html: "<p>Hi</p>",
    });

    expect(result).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});