"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PendingPayout {
  id: string;
  orderId: string | null;
  sellerId: string;
  sellerName: string;
  amountCents: number;
  status: string;
  failureReason: string | null;
  createdAt: string;
  daysSincePending: number;
}

export default function PayoutExceptionQueuePage() {
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    fetchPendingPayouts();
  }, []);

  async function fetchPendingPayouts() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/pending-payouts");
      const data = await response.json();
      setPayouts(data);
    } catch (error) {
      console.error("Failed to fetch payouts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function retrySelectedPayouts() {
    if (selectedIds.size === 0) return;

    setRetrying(true);
    try {
      const response = await fetch("/api/admin/retry-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutIds: Array.from(selectedIds),
        }),
      });

      if (response.ok) {
        setSelectedIds(new Set());
        await fetchPendingPayouts();
      }
    } catch (error) {
      console.error("Retry failed:", error);
    } finally {
      setRetrying(false);
    }
  }

  if (loading) return <div className="p-8">Loading pending payouts...</div>;

  const overduePayout = payouts.filter((p) => p.daysSincePending > 7);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-foreground">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground">Payout Exception Queue</h1>
        <p className="mt-2 text-foreground/60">
          Manage failed and pending payouts requiring manual intervention
        </p>
      </div>

      {overduePayout.length > 0 && (
        <div className="mb-6 rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4">
          <p className="font-semibold text-orange-900">
            ⚠️ {overduePayout.length} overdue payout{overduePayout.length === 1 ? "" : "s"} (7+ days)
          </p>
          <p className="mt-1 text-sm text-orange-800">
            These payouts need immediate attention. Click &quot;Retry Selected&quot; after updating seller
            details if applicable.
          </p>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-foreground/60">
          {selectedIds.size} of {payouts.length} selected
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={retrySelectedPayouts}
                disabled={retrying}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {retrying ? "Retrying..." : `Retry ${selectedIds.size} Payout${selectedIds.size === 1 ? "" : "s"}`}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50"
              >
                Clear Selection
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={selectedIds.size === payouts.length && payouts.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(payouts.map((p) => p.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  className="rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Seller</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Amount</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Pending Since</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-foreground/60">
                  No pending payouts. Great job! 🎉
                </td>
              </tr>
            ) : (
              payouts.map((payout) => (
                <tr key={payout.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(payout.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedIds);
                        if (e.target.checked) {
                          newSelected.add(payout.id);
                        } else {
                          newSelected.delete(payout.id);
                        }
                        setSelectedIds(newSelected);
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/admin/users/${payout.sellerId}`} className="text-blue-600 hover:underline">
                      {payout.sellerName}
                    </Link>
                  </td>
                  <td className="px-6 py-3 font-semibold">£{(payout.amountCents / 100).toFixed(2)}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        payout.status === "FAILED"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {payout.status}
                    </span>
                    {payout.failureReason && (
                      <p className="mt-1 text-xs text-red-600">{payout.failureReason || "Unknown error"}</p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {payout.daysSincePending} days
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/admin/users/${payout.sellerId}?tab=payouts`} className="text-sm text-blue-600 hover:underline">
                      Update Seller
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
