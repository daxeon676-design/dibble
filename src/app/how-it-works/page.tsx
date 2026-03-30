import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-foreground">
      <h1 className="text-3xl font-semibold">How Dibble Works</h1>
      <p className="mt-3 text-sm text-foreground/70">
        Dibble connects buyers with independent local makers. Browse products, place secure orders, and track delivery updates in your dashboard.
      </p>

      <section className="mt-8 space-y-3 rounded-lg border border-(--accent-terra)/30 bg-(--accent-beige)/40 p-5">
        <h2 className="text-lg font-semibold">For Buyers</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/80">
          <li>Browse categories and discover local products.</li>
          <li>Add items to your basket and check out securely.</li>
          <li>Track order status and message sellers when needed.</li>
        </ol>
      </section>

      <section className="mt-4 space-y-3 rounded-lg border border-(--accent-terra)/30 bg-(--accent-beige)/40 p-5">
        <h2 className="text-lg font-semibold">For Sellers</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/80">
          <li>Apply to become a seller and create your shop profile.</li>
          <li>List products with photos, pricing, and stock levels.</li>
          <li>Manage orders, dispatch updates, and payout setup.</li>
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/buyer/marketplace" className="rounded-md bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-white">
          Start Shopping
        </Link>
        <Link href="/buyer/seller-application" className="rounded-md border border-(--accent-terra)/40 px-4 py-2 text-sm text-(--accent-terra)">
          Become a Seller
        </Link>
      </div>
    </main>
  );
}
