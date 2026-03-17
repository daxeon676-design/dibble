import type { Metadata } from "next";
import { getLegalPagesContent } from "@/lib/legal-pages";

export const metadata: Metadata = { title: "FAQ – Dibble" };

export default async function FaqPage() {
  const content = await getLegalPagesContent();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">{content.faq.title}</h1>
      <p className="text-gray-500 mb-8">
        {content.faq.intro} Need more help?{" "}
        <a href={`mailto:${content.faq.contactEmail}`} className="text-green-700 underline">
          Contact us
        </a>
        .
      </p>

      <div className="space-y-6">
        {content.faq.items.map((faq, i) => (
          <div key={i} className="border-b pb-5">
            <h2 className="font-semibold text-lg mb-1">{faq.q}</h2>
            <p className="text-gray-700">{faq.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
