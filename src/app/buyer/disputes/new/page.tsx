/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewDisputePage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, reason, details }),
    });
    if (res.ok) {
      router.push("/buyer/disputes");
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to submit dispute.");
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Raise a Dispute</h1>
      <p className="text-gray-500 text-sm mb-6">
        Please try messaging the seller first. If that hasn't resolved your issue, fill in this form and our team will review it within 3 business days.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Order ID</label>
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
            placeholder="Paste your order ID"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <p className="text-xs text-gray-400 mt-1">
            Find this in Buyer → Orders.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="">— Select a reason —</option>
            <option value="Item not received">Item not received</option>
            <option value="Item not as described">Item not as described</option>
            <option value="Wrong item received">Wrong item received</option>
            <option value="Item damaged on arrival">Item damaged on arrival</option>
            <option value="Seller unresponsive">Seller unresponsive</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Details</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={6}
            required
            minLength={10}
            maxLength={2000}
            placeholder="Please describe the issue in detail, including any relevant dates or communication you've had with the seller…"
            className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{details.length}/2000</p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded border text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-red-600 text-white px-6 py-2 rounded text-sm hover:bg-red-500 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Dispute"}
          </button>
        </div>
      </form>
    </main>
  );
}
