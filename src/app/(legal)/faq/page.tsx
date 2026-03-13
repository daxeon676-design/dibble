import type { Metadata } from "next";

export const metadata: Metadata = { title: "FAQ – Dibble" };

const faqs: { q: string; a: string }[] = [
  {
    q: "How do I buy on Dibble?",
    a: "Browse the marketplace, add items to your cart, then proceed to checkout. Payment is processed securely via Stripe. You'll receive order confirmation immediately and can track your order from your dashboard.",
  },
  {
    q: "How do I become a seller?",
    a: "Register an account and navigate to the Seller Application page. Fill in your shop name and a short description of what you sell. Our team reviews applications within 2 business days. Once approved, you can start listing products straight away.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept all major credit and debit cards through Stripe. Your card details are never stored on Dibble's servers — they go directly to Stripe's secure payment infrastructure.",
  },
  {
    q: "How do I track my order?",
    a: "Head to Buyer → Orders. Each order shows a live status tracker that moves through Pending Payment → Processing → Shipped → Delivered. Sellers update the status as your order progresses.",
  },
  {
    q: "What if I have a problem with my order?",
    a: "First try messaging the seller directly. If that doesn't resolve the issue, you can raise a dispute from your Orders page. Our admin team will review it and aim to respond within 3 business days.",
  },
  {
    q: "Can I cancel an order?",
    a: "Orders can be cancelled by the seller if they are still in the Processing stage. Once an order has been shipped it cannot be cancelled. Contact the seller via the messaging feature as soon as possible.",
  },
  {
    q: "How does seller payment work?",
    a: "Payments are collected by Dibble at the time of purchase. Seller payouts are processed periodically via Stripe Connect. Make sure your payout details are up to date in your seller profile.",
  },
  {
    q: "Is my personal information safe?",
    a: "Yes. We store only the information needed to operate the platform. We never sell your data to third parties. See our Privacy Policy for full details.",
  },
  {
    q: "How do I update my profile?",
    a: "Go to your buyer or seller dashboard and click 'Edit Profile'. You can update your display name, bio, and avatar URL at any time.",
  },
  {
    q: "I can't log in — what should I do?",
    a: "Make sure you're using the same email address you registered with. If you've forgotten your password, please contact support at hello@dibble.market and we'll help you reset it.",
  },
];

export default function FaqPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Frequently Asked Questions</h1>
      <p className="text-gray-500 mb-8">
        Can&apos;t find your answer here?{" "}
        <a href="mailto:hello@dibble.market" className="text-green-700 underline">
          Contact us
        </a>
        .
      </p>

      <div className="space-y-6">
        {faqs.map((faq, i) => (
          <div key={i} className="border-b pb-5">
            <h2 className="font-semibold text-lg mb-1">{faq.q}</h2>
            <p className="text-gray-700">{faq.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
