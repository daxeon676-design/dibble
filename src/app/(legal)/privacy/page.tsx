/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy – Dibble" };

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 2025</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-800">
        <section>
          <h2 className="text-xl font-semibold">1. Who We Are</h2>
          <p>
            Dibble is a produce marketplace operated by Dibble Ltd. Our contact
            email is{" "}
            <a href="mailto:privacy@dibble.market" className="text-green-700 underline">
              privacy@dibble.market
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Data We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account data:</strong> email address, hashed password,
              display name, bio.
            </li>
            <li>
              <strong>Transaction data:</strong> order details, payment status
              (not card numbers — those go directly to Stripe).
            </li>
            <li>
              <strong>Communications:</strong> messages sent via the Platform's
              inbox feature.
            </li>
            <li>
              <strong>Technical data:</strong> IP address and browser type
              collected automatically in access logs.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To operate and improve the Platform.</li>
            <li>To process and fulfil orders.</li>
            <li>To resolve disputes and enforce our Terms.</li>
            <li>To send transactional emails (order confirmations, etc.).</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Legal Basis (GDPR)</h2>
          <p>
            We process personal data on the basis of contract performance (to
            provide you the service you signed up for) and legitimate interests
            (platform security and fraud prevention). Where required, we will
            ask for your explicit consent.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Data Sharing</h2>
          <p>
            We share data only with essential service providers: Stripe (payment
            processing) and our hosting provider. We do not sell personal data.
            When an order is placed, the seller receives the buyer's first name
            and delivery details necessary to fulfil the order.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Data Retention</h2>
          <p>
            Account data is retained for as long as your account is active plus
            7 years (for legal and tax compliance). You may request deletion of
            your account at any time; we will remove personal data that is not
            required for legal retention.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Your Rights</h2>
          <p>
            Under GDPR (and equivalent legislation) you have the right to:
            access, correct, restrict, port, or erase your personal data.
            Contact us at{" "}
            <a href="mailto:privacy@dibble.market" className="text-green-700 underline">
              privacy@dibble.market
            </a>{" "}
            to exercise any of these rights.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Cookies</h2>
          <p>
            Dibble uses a single session cookie for authentication. No
            third-party advertising or tracking cookies are set.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Changes</h2>
          <p>
            We may update this policy. Material changes will be notified via
            email or a prominent notice on the Platform.
          </p>
        </section>
      </div>
    </main>
  );
}
