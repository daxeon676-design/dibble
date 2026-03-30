"use client";

import { useMemo, useState } from "react";

type BuyerReturn = {
  id: string;
  orderId: string;
  reason: string;
  details: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED" | "CLOSED";
  requestedAt: string;
  updatedAt: string;
  resolutionNote?: string;
  rmaCode: string;
};

type EligibleOrder = {
  id: string;
  totalCents: number;
  createdAt: string;
  sellerName: string;
};

const statusStyles: Record<BuyerReturn["status"], string> = {
  REQUESTED: "bg-amber-100 text-amber-900",
  APPROVED: "bg-blue-100 text-blue-900",
  REJECTED: "bg-rose-100 text-rose-900",
  RECEIVED: "bg-indigo-100 text-indigo-900",
  REFUNDED: "bg-emerald-100 text-emerald-900",
  CLOSED: "bg-slate-200 text-slate-800",
};

export default function BuyerReturnsClient({
  initialReturns,
  eligibleOrders,
}: {
  initialReturns: BuyerReturn[];
  eligibleOrders: EligibleOrder[];
}) {
  const [rows, setRows] = useState<BuyerReturn[]>(initialReturns);
  const [orderId, setOrderId] = useState(eligibleOrders[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(orderId) && reason.trim().length >= 5 && details.trim().length >= 10;
  }, [orderId, reason, details]);

  async function submitReturnRequest() {
    if (!canSubmit) {
      setMessage("Please choose an order and add enough detail for the return request.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        reason: reason.trim(),
        details: details.trim(),
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; returnRequest?: BuyerReturn }
      | null;

    if (!response.ok || !payload?.returnRequest) {
      setMessage(payload?.error ?? "Failed to submit return request.");
      setSaving(false);
      return;
    }

    setRows((prev) => [payload.returnRequest!, ...prev]);
    setReason("");
    setDetails("");
    setMessage(`Return request ${payload.returnRequest.rmaCode} submitted.`);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Request Return</h2>
        {eligibleOrders.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No delivered orders are currently eligible for a new return request.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <select
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              {eligibleOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.id.slice(0, 8).toUpperCase()} - {order.sellerName} - GBP {(order.totalCents / 100).toFixed(2)}
                </option>
              ))}
            </select>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (for example: item damaged in transit)"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              placeholder="Include what happened and what outcome you expect."
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void submitReturnRequest()}
              disabled={!canSubmit || saving}
              className="rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit Return Request"}
            </button>
          </div>
        )}
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My Return Requests</h2>
        {rows.length === 0 ? <p className="text-sm text-slate-400">No return requests yet.</p> : null}
        {rows.map((row) => (
          <article key={row.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{row.rmaCode} · Order #{row.orderId.slice(0, 8).toUpperCase()}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[row.status]}`}>
                {row.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{row.reason}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{row.details}</p>
            {row.resolutionNote ? <p className="mt-2 text-sm text-emerald-300">Update: {row.resolutionNote}</p> : null}
            <p className="mt-2 text-xs text-slate-500">Updated {new Date(row.updatedAt).toLocaleString()}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
