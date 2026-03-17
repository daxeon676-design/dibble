"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SetupState = "loading" | "ready" | "verifying" | "done" | "error";

export default function AdminMfaSetupPage() {
  const { update } = useSession();
  const router = useRouter();

  const [state, setState] = useState<SetupState>("loading");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSetup() {
      try {
        const res = await fetch("/api/auth/mfa/setup");
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          if (!cancelled) {
            setErrorMsg(data.error ?? "Failed to load setup");
            setState("error");
          }
          return;
        }
        const data = (await res.json()) as { secret: string; qrCode: string };
        if (!cancelled) {
          setSecret(data.secret);
          setQrCode(data.qrCode);
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setErrorMsg("Network error. Please reload.");
          setState("error");
        }
      }
    }

    void loadSetup();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === "ready") {
      inputRef.current?.focus();
    }
  }, [state]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setState("verifying");

    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, secret }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? "Verification failed");
        setState("ready");
        return;
      }

      // Refresh JWT so mfaEnabled becomes true and middleware lets the admin through.
      await update();
      setState("done");
      router.push("/admin");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("ready");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up two-factor authentication</h1>
        <p className="text-sm text-gray-500 mb-6">
          Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password…), then
          enter the 6-digit code to confirm.
        </p>

        {state === "loading" && (
          <p className="text-center text-gray-400 py-8">Generating QR code…</p>
        )}

        {state === "error" && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {errorMsg}
          </div>
        )}

        {(state === "ready" || state === "verifying") && (
          <>
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="TOTP QR code" width={200} height={200} className="rounded-lg" />
            </div>

            <details className="mb-6">
              <summary className="text-xs text-gray-400 cursor-pointer select-none">
                Can&apos;t scan? Enter the code manually
              </summary>
              <p className="mt-2 font-mono text-xs break-all bg-gray-100 rounded p-2 select-all">
                {secret}
              </p>
            </details>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification code
                </label>
                <input
                  ref={inputRef}
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-center tracking-widest text-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {errorMsg && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={state === "verifying" || code.length !== 6}
                className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {state === "verifying" ? "Verifying…" : "Enable 2FA"}
              </button>
            </form>
          </>
        )}

        {state === "done" && (
          <p className="text-center text-green-600 font-semibold py-4">
            2FA enabled! Redirecting…
          </p>
        )}

        <div className="mt-6 border-t pt-4">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </main>
  );
}
