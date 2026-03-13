/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms & Conditions – Dibble" };

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 2025</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-800">
        <section>
          <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By creating an account or making a purchase on Dibble ("the
            Platform"), you agree to be bound by these Terms &amp; Conditions.
            If you do not agree, please do not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Eligibility</h2>
          <p>
            You must be at least 18 years old to register. By registering you
            confirm that all information you provide is accurate and complete.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Buyer Obligations</h2>
          <p>
            Buyers are responsible for reviewing product listings carefully
            before purchasing. Completed payments are binding subject to the
            seller's fulfilment obligations. Fraudulent chargebacks may result
            in account suspension.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Seller Obligations</h2>
          <p>
            Sellers must only list produce they own and are legally authorised
            to sell. Descriptions and images must accurately represent the
            product. Sellers must fulfil accepted orders in a timely manner
            and keep stock levels up to date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Payments</h2>
          <p>
            All payments are processed by Stripe. Dibble is not a party to the
            payment contract between buyer and seller. Dibble may deduct a
            platform fee before remitting proceeds to sellers, as notified
            separately.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Disputes</h2>
          <p>
            If an issue arises with a transaction, buyers should first contact
            the seller via the Platform's messaging feature. If unresolved,
            either party may raise a formal dispute via the Platform. Dibble's
            admin team will act as mediator and their decision shall be final.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Intellectual Property</h2>
          <p>
            All Platform content (logos, design, software) remains the
            intellectual property of Dibble. Sellers retain ownership of images
            and descriptions they upload but grant Dibble a non-exclusive
            licence to display them on the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Limitation of Liability</h2>
          <p>
            Dibble is a marketplace and does not warrant the quality, safety, or
            legality of listed products. To the maximum extent permitted by law,
            Dibble's liability for any claim shall not exceed the value of the
            relevant transaction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Termination</h2>
          <p>
            Dibble reserves the right to suspend or terminate any account that
            violates these Terms or is otherwise deemed harmful to the Platform
            or its users.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the
            Platform following notice of changes constitutes acceptance of the
            revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">11. Governing Law</h2>
          <p>
            These Terms are governed by the laws of England and Wales. Any
            disputes shall be subject to the exclusive jurisdiction of the
            courts of England and Wales.
          </p>
        </section>
      </div>
    </main>
  );
}
