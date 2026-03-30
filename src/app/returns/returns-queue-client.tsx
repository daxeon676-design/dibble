"use client";

import { useMemo, useState } from "react";

type ReturnQueueItem = {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  details: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED" | "CLOSED";
  requestedAt: string;
  updatedAt: string;
  resolutionNote?: string;
  reviewedById?: string;
  reviewedAt?: string;
  rmaCode: string;
  orderSummary?: {
    totalCents: number;
    buyerName: string;
    sellerName: string;
  } | null;
};

const statusOptions = ["APPROVED", "REJECTED", "RECEIVED", "REFUNDED", "CLOSED"] as const;

const statusStyles: Record<ReturnQueueItem["status"], string> = {
  REQUESTED: "bg-amber-100 text-amber-900",
  APPROVED: "bg-blue-100 text-blue-900",
  REJECTED: "bg-rose-100 text-rose-900",
  RECEIVED: "bg-indigo-100 text-indigo-900",
  REFUNDED: "bg-emerald-100 text-emerald-900",
  CLOSED: "bg-slate-200 text-slate-800",
};

export default function ReturnsQueueClient({
  title,
  initialRows,
}: {
  title: string;
  initialRows: ReturnQueueItem[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const pendingCount = useMemo(
    () => rows.filter((row) => row.status === "REQUESTED" || row.status === "APPROVED" || row.status === "RECEIVED").length,
    [rows],
  );

  async function updateReturn(id: string) {
    const status = statusDraft[id] || undefined;
    const resolutionNote = noteDraft[id]?.trim() || undefined;

    if (!status && !resolutionNote) {
      setFeedback((prev) => ({ ...prev, [id]: "Choose a status update or add a note." }));
      return;
    }

    setSavingId(id);
    setFeedback((prev) => ({ ...prev, [id]: "" }));

    const response = await fetch(`/api/returns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolutionNote }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; returnRequest?: ReturnQueueItem }
      | null;

    if (!response.ok || !payload?.returnRequest) {
      setFeedback((prev) => ({ ...prev, [id]: payload?.error ?? "Could not update return request." }));
      setSavingId(null);
      return;
    }

    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...payload.returnRequest! } : row)));
    setStatusDraft((prev) => ({ ...prev, [id]: "" }));
    setFeedback((prev) => ({ ...prev, [id]: "Return request updated." }));
    setSavingId(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-400">{pendingCount} active request(s)</p>
      </div>

      {rows.length === 0 ? <p className="text-sm text-slate-400">No return requests in this queue.</p> : null}

      {rows.map((row) => (
        <article key={row.id} className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{row.rmaCode} · Order #{row.orderId.slice(0, 8).toUpperCase()}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[row.status]}`}>
              {row.status}
            </span>
          </div>

          {row.orderSummary ? (
            <p className="mt-1 text-xs text-slate-400">
              Buyer: {row.orderSummary.buyerName} · Seller: {row.orderSummary.sellerName} · GBP {(row.orderSummary.totalCents / 100).toFixed(2)}
            </p>
          ) : null}

          <p className="mt-2 text-sm text-slate-300">{row.reason}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{row.details}</p>

          {row.resolutionNote ? <p className="mt-2 text-sm text-emerald-300">Current note: {row.resolutionNote}</p> : null}

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <select
              value={statusDraft[row.id] ?? ""}
              onChange={(event) => setStatusDraft((prev) => ({ ...prev, [row.id]: event.target.value }))}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
            >
              <option value="">No status change</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <textarea
              value={noteDraft[row.id] ?? row.resolutionNote ?? ""}
              onChange={(event) => setNoteDraft((prev) => ({ ...prev, [row.id]: event.target.value }))}
              rows={2}
              className="md:col-span-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Optional processing note"
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void updateReturn(row.id)}
              disabled={savingId === row.id}
              className="rounded border border-emerald-400 px-3 py-1.5 text-xs text-emerald-300 disabled:opacity-50"
            >
              {savingId === row.id ? "Saving..." : "Save Update"}
            </button>
            {feedback[row.id] ? <p className="text-xs text-slate-400">{feedback[row.id]}</p> : null}
          </div>

          <p className="mt-2 text-xs text-slate-500">Updated {new Date(row.updatedAt).toLocaleString()}</p>
        </article>
      ))}
    </section>
  );
}
