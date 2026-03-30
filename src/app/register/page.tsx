"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { HumanVerification } from "@/app/components/human-verification";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [humanVerificationToken, setHumanVerificationToken] = useState<string | null>(null);
  const [verificationResetSignal, setVerificationResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const registerResponse = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName, humanVerificationToken, termsAccepted, marketingOptIn }),
    });

    if (!registerResponse.ok) {
      const body = (await registerResponse.json().catch(() => null)) as { error?: string } | null;
      setError(`${body?.error ?? "Unable to register."} Please complete human verification again.`);
      setHumanVerificationToken(null);
      setVerificationResetSignal((v) => v + 1);
      setLoading(false);
      return;
    }

    const loginResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/buyer",
    });

    setLoading(false);

    if (!loginResult || loginResult.error) {
      setError("Account created. Please sign in manually.");
      return;
    }

    router.push(loginResult.url ?? "/buyer");
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16 text-slate-100">
      <h1 className="text-3xl font-semibold">Create your Dibble account</h1>
      <p className="mt-2 text-sm text-slate-400">All new accounts start as buyers.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
        <label className="block text-sm">
          <span>Display name (optional)</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm">Human verification</p>
          <HumanVerification onTokenChange={setHumanVerificationToken} resetSignal={verificationResetSignal} />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            required
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            I have read and agree to the{" "}
            <Link href="/terms" target="_blank" className="text-emerald-300 underline">Terms &amp; Conditions</Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-emerald-300 underline">Privacy Policy</Link>.
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>Send me occasional updates about new sellers and products on Dibble. You can unsubscribe at any time.</span>
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !humanVerificationToken || !termsAccepted}
          className="w-full rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-300">
        Already have an account? <Link className="text-emerald-300 underline" href="/login">Sign in</Link>
      </p>
    </main>
  );
}
