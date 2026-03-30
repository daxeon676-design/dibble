"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const REQUEST_TYPES = [
  { value: "access", label: "Access my data (Subject Access Request)" },
  { value: "erasure", label: "Erase my data (Right to be Forgotten)" },
  { value: "portability", label: "Export my data (Data Portability)" },
  { value: "correction", label: "Correct my data" },
  { value: "objection", label: "Object to processing" },
  { value: "withdraw_consent", label: "Withdraw consent" },
];

export default function DsarPage() {
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/dsar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, requestType, details }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Unable to submit request. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-xl border border-green-300 bg-green-50 p-6 text-center">
          <p className="text-lg font-semibold text-green-800">Request received</p>
          <p className="mt-2 text-sm text-green-700">
            We have logged your data rights request and will respond within 30 days as required by UK GDPR.
            A confirmation has been sent to your admin team.
          </p>
          <Link href="/privacy" className="mt-4 inline-block text-sm text-green-700 underline">
            Back to Privacy Policy
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Data Rights Request</h1>
      <p className="mt-2 text-sm text-gray-600">
        Use this form to exercise your rights under UK GDPR. We will acknowledge your request within 72 hours and respond
        within 30 days.
      </p>
      <p className="mt-1 text-sm text-gray-500">
        See our <Link href="/privacy" className="underline">Privacy Policy</Link> for full details on your rights.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-xl border border-gray-300 bg-gray-50 p-6">
        <label className="block text-sm">
          <span className="font-medium text-gray-800">Your email address <span className="text-red-500">*</span></span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-gray-800">Request type <span className="text-red-500">*</span></legend>
          <div className="mt-2 space-y-2">
            {REQUEST_TYPES.map((rt) => (
              <label key={rt.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  required
                  name="requestType"
                  value={rt.value}
                  checked={requestType === rt.value}
                  onChange={() => setRequestType(rt.value)}
                />
                {rt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium text-gray-800">Additional details <span className="text-gray-400">(optional)</span></span>
          <textarea
            maxLength={2000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Please describe the specific data or processing you are referring to, if relevant."
            className="mt-1 min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !email || !requestType}
          className="w-full rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit request"}
        </button>
      </form>
    </main>
  );
}
