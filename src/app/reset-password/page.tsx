"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="rounded-lg border border-red-500 bg-red-50 p-6 text-center">
        <p className="text-red-700">Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" className="mt-4 block text-sm underline">
          Request new link
        </Link>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="rounded-lg border border-(--accent-terra) bg-(--accent-beige) p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Password updated!</h2>
        <p className="mb-6 text-sm text-foreground/70">You can now sign in with your new password.</p>
        <Link
          href="/login"
          className="rounded-md bg-(--accent-terra) px-6 py-2 font-semibold text-(--accent-beige) hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);

    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setState("loading");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const body = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Something went wrong. Please try again.");
      }

      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-(--accent-terra) bg-(--accent-beige) p-6"
    >
      {errorMsg ? (
        <div className="rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      <label className="block text-sm">
        <span>New password</span>
        <input
          type="password"
          required
          minLength={8}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-(--accent-terra) bg-(--accent-beige) px-3 py-2 text-foreground"
        />
      </label>

      <label className="block text-sm">
        <span>Confirm new password</span>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-md border border-(--accent-terra) bg-(--accent-beige) px-3 py-2 text-foreground"
        />
      </label>

      <button
        type="submit"
        disabled={state === "loading"}
        className="w-full rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
      >
        {state === "loading" ? "Updating..." : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16 text-foreground">
      <h1 className="mb-2 text-3xl font-semibold">Set a new password</h1>
      <p className="mb-8 text-sm text-foreground/70">Choose a strong password for your account.</p>
      <Suspense fallback={<p className="text-sm">Loading...</p>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
