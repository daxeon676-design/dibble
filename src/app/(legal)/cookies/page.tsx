import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie Policy – Dibble" };

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-gray-900">
      <h1 className="mb-2 text-3xl font-bold">Cookie Policy</h1>
      <p className="mb-8 text-sm text-gray-500">Last updated: March 2026</p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold">1. Scope</h2>
          <p>
            This Cookie Policy explains how Dibble uses cookies and similar technologies under UK GDPR,
            the Data Protection Act 2018, and the Privacy and Electronic Communications Regulations (PECR).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Essential Cookies</h2>
          <p>
            We use essential cookies required for security and core functionality, such as authentication
            sessions, CSRF protection, and basic preference storage. These cookies are necessary for the site
            to operate and cannot be switched off.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Optional Cookies</h2>
          <p>
            Optional analytics or marketing cookies are only used if you provide consent through our cookie
            banner. If you reject non-essential cookies, only essential cookies remain active.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Consent and Control</h2>
          <p>
            When you first visit Dibble, you can accept or reject non-essential cookies. Your choice is stored
            locally for future visits. You can also clear your browser cookies to reset preferences.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Retention</h2>
          <p>
            Cookie lifetimes vary by purpose. Session cookies typically expire when you close your browser,
            while preference cookies may persist for up to 12 months unless removed earlier.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Contact</h2>
          <p>
            If you have questions about cookies or data protection, contact us at
            <a className="ml-1 text-green-700 underline" href="mailto:privacy@dibble.market">
              privacy@dibble.market
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
