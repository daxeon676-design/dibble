import type { Metadata } from "next";
import { getLegalPagesContent } from "@/lib/legal-pages";

export const metadata: Metadata = { title: "Terms & Conditions – Dibble" };

export default async function TermsPage() {
  const content = await getLegalPagesContent();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">{content.terms.title}</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {content.terms.lastUpdated}</p>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-800">
        {content.terms.sections.map((section, index) => (
          <section key={`terms-section-${index}`}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
