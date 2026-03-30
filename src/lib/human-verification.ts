const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

function getClientIp(request: Request): string | undefined {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const xff = request.headers.get("x-forwarded-for")?.trim();
  if (!xff) return undefined;

  return xff.split(",")[0]?.trim() || undefined;
}

export async function verifyTurnstileToken(request: Request, token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    console.warn("[turnstile] Missing TURNSTILE_SECRET_KEY");
    return false;
  }

  const normalizedToken = token.trim();
  if (!normalizedToken) {
    console.warn("[turnstile] Missing token in verification call");
    return false;
  }

  const formData = new URLSearchParams();
  formData.set("secret", secret);
  formData.set("response", normalizedToken);

  const remoteIp = getClientIp(request);
  if (remoteIp) {
    formData.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as TurnstileVerifyResponse;
    if (!result.success) {
      console.warn("[turnstile] Verification failed", {
        codes: result["error-codes"] ?? [],
        hasRemoteIp: Boolean(remoteIp),
      });
    }
    return Boolean(result.success);
  } catch {
    console.warn("[turnstile] Verification request failed");
    return false;
  }
}
