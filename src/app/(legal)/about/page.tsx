import type { Metadata } from "next";
import { getLegalPagesContent } from "@/lib/legal-pages";

export const metadata: Metadata = { title: "About Us – Dibble" };

export default async function AboutPage() {
  const content = await getLegalPagesContent();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-3">{content.about.title}</h1>
      <p className="text-sm text-gray-500 mb-6">{content.about.subtitle}</p>

      <section className="prose prose-gray max-w-none space-y-4">
        {content.about.body.split("\n\n").map((paragraph, index) => (
          <p key={`about-paragraph-${index}`}>{paragraph}</p>
        ))}

        <h2 className="text-xl font-semibold mt-8">Contact Us</h2>
        <p>
          Questions or feedback? Reach us at{" "}
          <a
            href={`mailto:${content.about.contactEmail}`}
            className="text-green-700 underline"
          >
            {content.about.contactEmail}
          </a>
          . We read every message.
        </p>
      </section>
    </main>
  );
}
