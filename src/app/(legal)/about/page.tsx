import type { Metadata } from "next";

export const metadata: Metadata = { title: "About Us – Dibble" };

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">About Dibble</h1>

      <section className="prose prose-gray max-w-none space-y-4">
        <p>
          Dibble is a fresh-produce marketplace connecting local growers with
          buyers who care about where their food comes from. We believe great
          food starts at the source — and that every farmer deserves a fair
          platform to reach customers directly.
        </p>

        <h2 className="text-xl font-semibold mt-8">Our Mission</h2>
        <p>
          To make locally grown, seasonal produce as easy to buy as anything
          from a supermarket — while keeping more of every sale in the hands of
          the people who grew it.
        </p>

        <h2 className="text-xl font-semibold mt-8">How It Works</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Sellers</strong> apply for a Dibble shop, list their
            products with photos and pricing, and fulfil orders at their own
            pace.
          </li>
          <li>
            <strong>Buyers</strong> browse the marketplace, add items to their
            cart, and pay securely through Stripe. Orders are tracked from
            payment through to delivery.
          </li>
          <li>
            <strong>Admins</strong> review seller applications, resolve disputes,
            and monitor platform health — keeping Dibble trustworthy for
            everyone.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">Contact Us</h2>
        <p>
          Questions or feedback? Reach us at{" "}
          <a
            href="mailto:hello@dibble.market"
            className="text-green-700 underline"
          >
            hello@dibble.market
          </a>
          . We read every message.
        </p>
      </section>
    </main>
  );
}
