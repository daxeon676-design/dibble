"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl font-bold text-(--accent-terra)">Oops</p>
      <h1 className="mt-4 text-xl font-semibold text-foreground">Something went wrong</h1>
      <p className="mt-2 text-sm text-foreground/60">
        {error.digest ? `Reference: ${error.digest}` : "An unexpected error occurred loading this page."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-(--accent-terra) px-5 py-2 font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-full border border-(--accent-terra)/40 px-5 py-2 text-(--accent-terra) hover:bg-(--accent-beige)/40 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
