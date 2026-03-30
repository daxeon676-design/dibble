"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { addWishlistProduct } from "@/app/components/saved-item-button";

type SessionResponse = {
  user?: {
    role?: "ADMIN" | "SELLER" | "BUYER";
  };
} | null;

export default function LoginPage() {
  const callbackUrl = useMemo(() => {
    if (typeof window === "undefined") return "/buyer";

    const explicit = new URLSearchParams(window.location.search).get("callbackUrl");
    if (explicit) return explicit;

    const referrer = document.referrer;
    if (!referrer) return "/buyer";

    try {
      const currentOrigin = window.location.origin;
      const refUrl = new URL(referrer);
      if (refUrl.origin === currentOrigin && refUrl.pathname !== "/login") {
        return `${refUrl.pathname}${refUrl.search}`;
      }
    } catch {
      return "/buyer";
    }

    return "/buyer";
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
      rememberMe,
    });

    setLoading(false);

    if (!result || result.error) {
      setError("Invalid email or password.");
      return;
    }

    // Respect explicit callback first.
    const explicitCallbackUrl =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("callbackUrl");

    if (explicitCallbackUrl) {
      const params = new URLSearchParams(window.location.search);
      const wishlistId = params.get("wishlistId");
      const wishlistLabel = params.get("wishlistLabel");
      const wishlistHref = params.get("wishlistHref");
      if (wishlistId && wishlistLabel && wishlistHref) {
        addWishlistProduct({ id: wishlistId, label: wishlistLabel, href: wishlistHref });
      }

      window.location.href = result.url ?? explicitCallbackUrl;
      return;
    }

    // Default route by role so admin accounts land on admin pages.
    // Use hard navigation so the server-rendered navbar picks up the new session cookie.
    const session = (await fetch("/api/auth/session").then((r) => r.json()).catch(() => null)) as SessionResponse;
    const role = session?.user?.role;

    if (role === "ADMIN") {
      window.location.href = "/admin";
      return;
    }

    if (role === "SELLER") {
      window.location.href = "/seller";
      return;
    }

    // Buyers always land on the homepage
    window.location.href = "/";
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16 text-foreground">
      <h1 className="text-3xl font-semibold">Sign in to Dibble</h1>

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-(--accent-terra) bg-(--accent-beige) p-6">
        <label className="block text-sm">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-(--accent-terra) bg-(--accent-beige) px-3 py-2 text-foreground"
          />
        </label>

        <label className="block text-sm">
          <span>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-(--accent-terra) bg-(--accent-beige) px-3 py-2 text-foreground"
          />
        </label>

        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-(--accent-terra) underline hover:opacity-80">
            Forgot password?
          </Link>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="accent-(--accent-terra)"
          />
          <span>Remember me</span>
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige) disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-sm text-foreground/80">
        Need an account? <Link className="text-(--accent-terra) underline" href="/register">Create one</Link>
      </p>
    </main>
  );
}
