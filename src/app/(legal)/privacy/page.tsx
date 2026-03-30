import type { Metadata } from "next";
import Link from "next/link";
import { getLegalPagesContent } from "@/lib/legal-pages";

export const metadata: Metadata = { title: "Privacy Policy – Dibble" };

export default async function PrivacyPage() {
  const content = await getLegalPagesContent();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">{content.privacy.title}</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {content.privacy.lastUpdated}</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-800">
        {content.privacy.sections.map((section, index) => (
          <section key={`privacy-section-${index}`}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-gray-300 bg-gray-50 p-6">
        <h2 className="text-lg font-semibold text-gray-800">Exercise Your Data Rights</h2>
        <p className="mt-2 text-sm text-gray-600">
          Under UK GDPR you have the right to access, correct, erase, or port your personal data. You can also object to processing or withdraw consent.
          Use the form below to submit a Data Subject Access Request (DSAR) or any other data rights request.
        </p>
        <Link
          href="/privacy/dsar"
          className="mt-4 inline-block rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Submit a data rights request &rarr;
        </Link>
      </div>
    </main>
  );
}
