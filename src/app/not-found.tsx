import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl font-bold text-(--accent-terra)">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 text-sm text-foreground/60">
        We couldn&apos;t find the page you were looking for.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
        <Link
          href="/"
          className="rounded-full bg-(--accent-terra) px-5 py-2 font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Go Home
        </Link>
        <Link
          href="/buyer/marketplace"
          className="rounded-full border border-(--accent-terra)/40 px-5 py-2 text-(--accent-terra) hover:bg-(--accent-beige)/40 transition-colors"
        >
          Browse Marketplace
        </Link>
      </div>
    </main>
  );
}
