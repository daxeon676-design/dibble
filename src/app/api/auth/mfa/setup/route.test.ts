import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.fn();
const mockGenerateSecret = vi.fn().mockReturnValue("MOCKED_SECRET_BASE32");
const mockGenerateURI = vi
  .fn()
  .mockReturnValue("otpauth://totp/Dibble%20Admin:admin%40example.com?secret=MOCKED_SECRET_BASE32");
const mockVerify = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const mockPrismaUpdate = vi.fn();
const mockPrismaCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: mockPrismaUpdate,
      count: mockPrismaCount,
    },
  },
}));

vi.mock("otplib", () => ({
  generateSecret: mockGenerateSecret,
  generateURI: mockGenerateURI,
  verify: mockVerify,
}));

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,MOCK_QR"),
}));

describe("MFA setup API endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateSecret.mockReturnValue("MOCKED_SECRET_BASE32");
    mockGenerateURI.mockReturnValue("otpauth://totp/Dibble%20Admin:admin%40example.com?secret=MOCKED_SECRET_BASE32");
  });

  describe("GET /api/auth/mfa/setup", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);
      const { GET } = await import("@/app/api/auth/mfa/setup/route");

      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 when authenticated as non-admin", async () => {
      mockGetServerSession.mockResolvedValueOnce({ user: { id: "seller-1", role: "SELLER", email: "s@example.com" } });
      const { GET } = await import("@/app/api/auth/mfa/setup/route");

      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns qrCode and secret for admin user", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" },
      });
      const { GET } = await import("@/app/api/auth/mfa/setup/route");

      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { secret: string; qrCode: string };
      expect(body.secret).toBe("MOCKED_SECRET_BASE32");
      expect(body.qrCode).toMatch(/^data:image/);
    });
  });

  describe("POST /api/auth/mfa/setup", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);
      const { POST } = await import("@/app/api/auth/mfa/setup/route");

      const res = await POST(
        new Request("http://localhost/api/auth/mfa/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "123456", secret: "SECRET" }),
        }),
      );
      expect(res.status).toBe(401);
    });

    it("returns 422 when TOTP code is invalid", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" },
      });
      mockVerify.mockResolvedValueOnce({ valid: false, delta: null });

      const { POST } = await import("@/app/api/auth/mfa/setup/route");
      const res = await POST(
        new Request("http://localhost/api/auth/mfa/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "000000", secret: "WRONG_SECRET" }),
        }),
      );
      expect(res.status).toBe(422);
    });

    it("enables MFA in DB and returns ok when code is valid", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" },
      });
      mockVerify.mockResolvedValueOnce({ valid: true, delta: 0 });
      mockPrismaUpdate.mockResolvedValueOnce({ id: "admin-1", mfaEnabled: true });

      const { POST } = await import("@/app/api/auth/mfa/setup/route");
      const res = await POST(
        new Request("http://localhost/api/auth/mfa/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "123456", secret: "MOCKED_SECRET_BASE32" }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: "admin-1" },
        data: { mfaEnabled: true, mfaSecret: "MOCKED_SECRET_BASE32" },
      });
    });
  });

  describe("DELETE /api/auth/mfa/setup", () => {
    it("returns 409 when current admin is the only one with MFA", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" },
      });
      mockPrismaCount.mockResolvedValueOnce(0);

      const { DELETE } = await import("@/app/api/auth/mfa/setup/route");
      const res = await DELETE();
      expect(res.status).toBe(409);
    });

    it("disables MFA when other admins have MFA enabled", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" },
      });
      mockPrismaCount.mockResolvedValueOnce(1);
      mockPrismaUpdate.mockResolvedValueOnce({ id: "admin-1", mfaEnabled: false });

      const { DELETE } = await import("@/app/api/auth/mfa/setup/route");
      const res = await DELETE();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: "admin-1" },
        data: { mfaEnabled: false, mfaSecret: null },
      });
    });
  });
});
