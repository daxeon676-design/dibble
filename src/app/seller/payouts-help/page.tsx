import Link from "next/link";

export default function SellerPayoutsHelpPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-slate-100">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Seller Payout Setup Guide</h1>
        <Link href="/seller" className="rounded-md border border-slate-700 px-3 py-2 text-sm">
          Back to Seller Dashboard
        </Link>
      </div>

      <section className="mt-6 space-y-4 rounded-md border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">What You Need To Do</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>Go to Seller Dashboard and open the Seller Payouts section.</li>
          <li>Click Set Up Payouts to complete Stripe onboarding.</li>
          <li>Submit identity and bank details inside Stripe Express.</li>
          <li>Return and click Refresh until both Charge Capability and Payout Capability show Enabled.</li>
        </ol>
      </section>

      <section className="mt-4 space-y-3 rounded-md border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Manual Payout Profile (Fallback)</h2>
        <p className="text-sm text-slate-300">
          If Stripe onboarding cannot be completed immediately, fill in Manual payout details so admin can process fallback payouts.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Method: Stripe Connect / Bank transfer / PayPal / Manual review</li>
          <li>Payee name: legal name for payouts</li>
          <li>Payout email: contact email for payout issues</li>
          <li>Bank transfer: bank name + last 4 account digits + last 2 sort code digits</li>
          <li>PayPal: PayPal receiving email</li>
          <li>Notes: any admin instructions</li>
        </ul>
      </section>

      <section className="mt-4 space-y-3 rounded-md border border-amber-800 bg-amber-950/30 p-5">
        <h2 className="text-lg font-semibold text-amber-200">Important Timing</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-amber-100">
          <li>Set up payouts as soon as you start listing products.</li>
          <li>Without completed payout setup, funds may remain pending for manual handling.</li>
          <li>Keep payout and bank details up to date to avoid payout delays.</li>
        </ul>
      </section>
    </main>
  );
}
