"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <p className="text-5xl font-bold text-red-500">Something went wrong</p>
          <p className="mt-3 text-sm text-gray-500">
            {error.digest ? `Error ID: ${error.digest}` : "An unexpected error occurred."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="rounded-full border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Go Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
