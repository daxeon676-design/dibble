"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SetupState = "loading" | "ready" | "verifying" | "done" | "error";

export default function AccountMfaClient({ callbackPath }: { callbackPath: string }) {
  const { update } = useSession();
  const router = useRouter();

  const [state, setState] = useState<SetupState>("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSetup() {
      try {
        const res = await fetch("/api/auth/mfa/setup");
        const data = (await res.json().catch(() => null)) as { secret?: string; qrCode?: string; error?: string } | null;
        if (!res.ok || !data?.secret || !data.qrCode) {
          if (!cancelled) {
            setErrorMsg(data?.error ?? "Failed to load setup.");
            setState("error");
          }
          return;
        }

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

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg("");
    setState("verifying");

    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, secret }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error ?? "Verification failed.");
        setState("ready");
        return;
      }

      await update({ mfaEnabled: true });
      setState("done");
      router.replace(callbackPath);
      router.refresh();
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("ready");
    }
  }

  async function handleDisable() {
    setErrorMsg("");
    setState("verifying");
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error ?? "Could not disable 2FA.");
        setState("ready");
        return;
      }

      await update({ mfaEnabled: false });
      setState("done");
      router.replace(callbackPath);
      router.refresh();
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("ready");
    }
  }

  return (
    <main className="min-h-screen bg-(--accent-beige)/30 p-6 text-foreground">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-(--accent-terra)/20 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-(--accent-terra)">Two-Factor Authentication</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Protect your account by connecting an authenticator app and entering a one-time code.
        </p>

        {state === "loading" ? <p className="py-8 text-center text-sm text-foreground/60">Generating setup...</p> : null}

        {state === "error" ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</div>
        ) : null}

        {(state === "ready" || state === "verifying") && qrCode ? (
          <>
            <div className="mt-5 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="MFA QR code" width={200} height={200} className="rounded-md" />
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-foreground/60">Can&apos;t scan? Enter secret manually</summary>
              <p className="mt-2 rounded bg-(--accent-beige)/50 p-2 font-mono text-xs break-all">{secret}</p>
            </details>

            <form onSubmit={handleVerify} className="mt-4 space-y-3">
              <label htmlFor="account-mfa-code" className="block text-sm font-medium">
                Verification code
              </label>
              <input
                ref={inputRef}
                id="account-mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full rounded-md border border-(--accent-terra)/40 px-4 py-2 text-center font-mono text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
              />

              {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}

              <button
                type="submit"
                disabled={state === "verifying" || code.length !== 6}
                className="w-full rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige) disabled:opacity-50"
              >
                {state === "verifying" ? "Verifying..." : "Enable 2FA"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => void handleDisable()}
              disabled={state === "verifying"}
              className="mt-3 w-full rounded-md border border-(--accent-terra)/40 px-4 py-2 text-sm text-(--accent-terra) disabled:opacity-50"
            >
              Disable 2FA
            </button>
          </>
        ) : null}

        {state === "done" ? <p className="mt-4 text-sm font-semibold text-(--accent-green)">Saved. Redirecting...</p> : null}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-5 w-full text-xs text-foreground/60 hover:text-foreground/80"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
