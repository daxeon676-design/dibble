"use client";

import { useState } from "react";

interface UserSnippet {
  id: string;
  email: string;
  displayName?: string | null;
  role?: string;
}

interface DisputeMessage {
  id: string;
  body: string;
  createdAt: Date | string;
  sender: UserSnippet;
}

interface PaymentSummary {
  id: string;
  status: string;
  amountCents: number;
  refundAmountCents: number;
  refundedAt: Date | string | null;
  stripeRefundId: string | null;
  refundReason: string | null;
}

interface Dispute {
  id: string;
  status: string;
  reason: string;
  details: string;
  resolution: string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  order: {
    id: string;
    totalCents: number;
    createdAt: Date | string;
    payment: PaymentSummary | null;
    buyer: UserSnippet;
    seller: UserSnippet;
  };
  raisedBy: UserSnippet;
  resolvedBy: UserSnippet | null;
  messages: DisputeMessage[];
}

const statusColors: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
};

export default function AdminDisputesClient({ disputes: initial }: { disputes: Dispute[] }) {
  const [disputes, setDisputes] = useState<Dispute[]>(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [replying, setReplying] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  function applyDisputeUpdate(updated: Dispute) {
    setDisputes((prev) => prev.map((dispute) => (dispute.id === updated.id ? updated : dispute)));
  }

  async function updateStatus(id: string, status: string) {
    setFeedback((prev) => ({ ...prev, [id]: "" }));
    setSaving(id);
    const res = await fetch(`/api/disputes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution: resolution[id] }),
    });
    if (res.ok) {
      const updated: Dispute = await res.json();
      applyDisputeUpdate(updated);
      setFeedback((prev) => ({ ...prev, [id]: `Dispute marked ${status.replace("_", " ").toLowerCase()}.` }));
    } else {
      const payload = await res.json().catch(() => null);
      setFeedback((prev) => ({ ...prev, [id]: payload?.error ?? "Could not update dispute." }));
    }
    setSaving(null);
  }

  async function postReply(id: string) {
    const body = replyDrafts[id]?.trim();
    if (!body) {
      setFeedback((prev) => ({ ...prev, [id]: "Write a reply before posting it." }));
      return;
    }

    setFeedback((prev) => ({ ...prev, [id]: "" }));
    setReplying(id);
    const res = await fetch(`/api/disputes/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    if (res.ok) {
      const message: DisputeMessage = await res.json();
      setDisputes((prev) =>
        prev.map((dispute) =>
          dispute.id === id
            ? { ...dispute, messages: [...dispute.messages, message], status: dispute.status === "OPEN" ? "UNDER_REVIEW" : dispute.status }
            : dispute,
        ),
      );
      setReplyDrafts((prev) => ({ ...prev, [id]: "" }));
      setFeedback((prev) => ({ ...prev, [id]: "Reply posted." }));
    } else {
      const payload = await res.json().catch(() => null);
      setFeedback((prev) => ({ ...prev, [id]: payload?.error ?? "Could not post reply." }));
    }

    setReplying(null);
  }

  async function issueRefund(id: string) {
    const dispute = disputes.find((entry) => entry.id === id);
    if (!dispute?.order.payment || dispute.order.payment.refundedAt) {
      return;
    }

    const confirmed = window.confirm(
      `Issue a full refund of £${(dispute.order.payment.amountCents / 100).toFixed(2)} for order #${dispute.order.id.slice(0, 8).toUpperCase()}?`,
    );

    if (!confirmed) return;

    setFeedback((prev) => ({ ...prev, [id]: "" }));
    setRefunding(id);

    const res = await fetch(`/api/disputes/${id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: resolution[id] }),
    });

    if (res.ok) {
      const payload: { dispute: Dispute; payoutRecoveryRequired: boolean } = await res.json();
      applyDisputeUpdate(payload.dispute);
      setFeedback((prev) => ({
        ...prev,
        [id]: payload.payoutRecoveryRequired
          ? "Refund issued. Seller payout was already marked paid out, so any recovery remains manual."
          : "Refund issued and pending seller payout cancelled.",
      }));
    } else {
      const payload = await res.json().catch(() => null);
      setFeedback((prev) => ({ ...prev, [id]: payload?.error ?? "Could not issue refund." }));
    }

    setRefunding(null);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Disputes</h1>

      {disputes.length === 0 ? (
        <p className="text-gray-500">No disputes on record.</p>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.id} className="border rounded overflow-hidden">
              {/* Summary row */}
              <button
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
              >
                <div>
                  <span className="font-medium text-sm">
                    Order #{d.order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-gray-500 text-xs ml-3">
                    by {d.raisedBy.displayName ?? d.raisedBy.email}
                  </span>
                  <span className="text-gray-400 text-xs ml-3">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-sm ml-3 text-gray-700">{d.reason}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[d.status]}`}>
                  {d.status.replace("_", " ")}
                </span>
              </button>

              {/* Expanded detail */}
              {expanded === d.id && (
                <div className="px-4 pb-4 border-t bg-gray-50 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mt-3">Buyer Details</p>
                    <p className="text-sm">{d.raisedBy.email}</p>
                    <p className="text-xs text-gray-500 mt-2">Seller Details</p>
                    <p className="text-sm">{d.order.seller.displayName ?? d.order.seller.email}</p>
                    <p className="text-xs text-gray-500 mt-2">Order Value</p>
                    <p className="text-sm">£{(d.order.totalCents / 100).toFixed(2)}</p>
                    {d.order.payment && (
                      <>
                        <p className="text-xs text-gray-500 mt-2">Payment Status</p>
                        <p className="text-sm">{d.order.payment.status}</p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Original Dispute</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{d.details}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Timeline</p>
                    <div className="mt-2 space-y-3">
                      <div className="rounded border border-slate-200 bg-white p-3 text-sm text-gray-800">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-gray-900">Buyer opened dispute</p>
                          <p className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap">{d.details}</p>
                      </div>
                      {d.messages.map((message) => (
                        <div key={message.id} className="rounded border border-slate-200 bg-white p-3 text-sm text-gray-800">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-gray-900">
                              {message.sender.displayName ?? message.sender.email}
                            </p>
                            <p className="text-xs text-gray-400">{new Date(message.createdAt).toLocaleString()}</p>
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                            {message.sender.role === "ADMIN" ? "Admin reply" : "Participant update"}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {d.resolution && (
                    <div>
                      <p className="text-xs text-gray-500">Current Resolution Note</p>
                      <p className="text-sm text-gray-800">{d.resolution}</p>
                    </div>
                  )}
                  {d.order.payment?.refundedAt && (
                    <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <p className="font-medium">
                        Refunded £{(d.order.payment.refundAmountCents / 100).toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-emerald-800">
                        Processed {new Date(d.order.payment.refundedAt).toLocaleString()}
                      </p>
                      {d.order.payment.refundReason && (
                        <p className="mt-1 text-xs text-emerald-800">Reason: {d.order.payment.refundReason}</p>
                      )}
                    </div>
                  )}

                  <div className="pt-2 space-y-2">
                    <textarea
                      value={replyDrafts[d.id] ?? ""}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder="Post an admin reply visible in the dispute timeline..."
                      className="w-full border rounded px-3 py-2 text-sm resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => postReply(d.id)}
                        disabled={replying === d.id}
                        className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm hover:bg-slate-700 disabled:opacity-50"
                      >
                        {replying === d.id ? "Posting..." : "Post Reply"}
                      </button>
                    </div>

                    <textarea
                      value={resolution[d.id] ?? d.resolution ?? ""}
                      onChange={(e) =>
                        setResolution((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder="Add or update the dispute outcome note..."
                      className="w-full border rounded px-3 py-2 text-sm resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      {d.status === "OPEN" && (
                        <button
                          onClick={() => updateStatus(d.id, "UNDER_REVIEW")}
                          disabled={saving === d.id}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-500 disabled:opacity-50"
                        >
                          Mark Under Review
                        </button>
                      )}
                      <button
                        onClick={() => updateStatus(d.id, "RESOLVED")}
                        disabled={saving === d.id}
                        className="bg-green-700 text-white px-3 py-1.5 rounded text-sm hover:bg-green-600 disabled:opacity-50"
                      >
                        Mark Resolved
                      </button>
                      <button
                        onClick={() => updateStatus(d.id, "CLOSED")}
                        disabled={saving === d.id}
                        className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-500 disabled:opacity-50"
                      >
                        Close
                      </button>
                      {d.order.payment && !d.order.payment.refundedAt && d.order.payment.status === "SUCCEEDED" && (
                        <button
                          onClick={() => issueRefund(d.id)}
                          disabled={refunding === d.id}
                          className="bg-rose-700 text-white px-3 py-1.5 rounded text-sm hover:bg-rose-600 disabled:opacity-50"
                        >
                          {refunding === d.id ? "Refunding..." : `Issue Full Refund (£${(d.order.payment.amountCents / 100).toFixed(2)})`}
                        </button>
                      )}
                    </div>
                    {feedback[d.id] && <p className="text-sm text-gray-600">{feedback[d.id]}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
