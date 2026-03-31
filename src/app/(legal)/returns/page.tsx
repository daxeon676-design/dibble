import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Returns & Refunds - Dibble" };

export default function ReturnsPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-gray-800">
      <h1 className="mb-2 text-3xl font-bold">Returns &amp; Refunds Policy</h1>
      <p className="mb-8 text-sm text-gray-500">Last updated: March 31, 2026</p>

      <div className="space-y-7 leading-relaxed">
        <section>
          <h2 className="mb-2 text-xl font-semibold">1. Return eligibility</h2>
          <p>
            Returns can be requested for eligible delivered orders through your Dibble account. To request a return,
            open your order history and submit a return request with the reason and supporting details.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">2. Return window</h2>
          <p>
            Return requests should be submitted within 14 days of delivery unless local consumer rights provide a longer
            period. Requests submitted outside this period may be declined unless required by law.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">3. Review process</h2>
          <p>
            Once submitted, your request is reviewed by the seller and/or Dibble support team. You will receive status
            updates in your returns dashboard and by email if you have return notifications enabled.
          </p>
          <p className="mt-2">
            Return statuses may include requested, approved, rejected, received, refunded, or closed.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">4. Refund timing</h2>
          <p>
            If a return is approved for refund, payments are refunded to the original payment method. Processing times
            vary by payment provider and can take 5-10 business days after the refund is issued.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">5. Condition of returned items</h2>
          <p>
            Returned items should be sent back in the condition agreed during the return approval process. Items that are
            damaged, used beyond reasonable inspection, or missing components may be eligible only for partial refund or
            rejection where legally allowed.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">6. Non-returnable items</h2>
          <p>
            Certain custom, perishable, or hygiene-sensitive products may be non-returnable unless faulty or not as
            described. Product-specific terms shown at checkout or in the listing apply.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">7. Help and disputes</h2>
          <p>
            If you are unable to resolve a return issue directly, you can raise a dispute in your account. Dibble may
            review the order history, return history, and supporting evidence to determine an outcome.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">8. Contact</h2>
          <p>
            Need help with a return? Contact us at{" "}
            <Link href="mailto:support@dibblemarketplace.com" className="text-(--accent-terra) hover:underline">
              support@dibblemarketplace.com
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
