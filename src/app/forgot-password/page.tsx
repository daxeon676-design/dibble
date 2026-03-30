"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Something went wrong. Please try again.");
      }

      setState("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-6 py-20 text-foreground">
        <div className="rounded-lg border border-(--accent-terra) bg-(--accent-beige) p-8 text-center">
          <h1 className="mb-4 text-2xl font-semibold">Check your email</h1>
          <p className="mb-2 text-sm">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. It expires in 1 hour.
          </p>
          <p className="text-sm text-foreground/60">Didn&apos;t receive it? Check your spam folder or{" "}
            <button type="button" onClick={() => setState("idle")} className="underline hover:opacity-80">
              try again
            </button>.
          </p>
          <Link href="/login" className="mt-6 block text-sm text-(--accent-terra) underline">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16 text-foreground">
      <h1 className="text-3xl font-semibold">Forgot your password?</h1>
      <p className="mt-2 text-sm text-foreground/70">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-lg border border-(--accent-terra) bg-(--accent-beige) p-6"
      >
        {state === "error" && errorMsg ? (
          <div className="rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
        ) : null}

        <label className="block text-sm">
          <span>Email address</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-(--accent-terra) bg-(--accent-beige) px-3 py-2 text-foreground"
          />
        </label>

        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
        >
          {state === "loading" ? "Sending..." : "Send reset link"}
        </button>

        <p className="text-center text-sm">
          <Link href="/login" className="text-(--accent-terra) hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
