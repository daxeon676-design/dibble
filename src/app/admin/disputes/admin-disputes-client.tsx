"use client";

import { useState } from "react";

interface UserSnippet {
  id: string;
  email: string;
  displayName?: string | null;
}

interface Dispute {
  id: string;
  status: string;
  reason: string;
  details: string;
  resolution: string | null;
  createdAt: Date | string;
  order: { id: string; totalCents: number; createdAt: Date | string };
  raisedBy: UserSnippet;
  resolvedBy: UserSnippet | null;
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
  const [saving, setSaving] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    const res = await fetch(`/api/disputes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution: resolution[id] }),
    });
    if (res.ok) {
      const updated: Dispute = await res.json();
      setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
    }
    setSaving(null);
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
                    <p className="text-xs text-gray-500 mt-2">Order Value</p>
                    <p className="text-sm">£{(d.order.totalCents / 100).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Dispute Details</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{d.details}</p>
                  </div>
                  {d.resolution && (
                    <div>
                      <p className="text-xs text-gray-500">Current Resolution Note</p>
                      <p className="text-sm text-gray-800">{d.resolution}</p>
                    </div>
                  )}

                  {d.status !== "RESOLVED" && d.status !== "CLOSED" && (
                    <div className="pt-2 space-y-2">
                      <textarea
                        value={resolution[d.id] ?? ""}
                        onChange={(e) =>
                          setResolution((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                        rows={3}
                        placeholder="Add a resolution note (optional)…"
                        className="w-full border rounded px-3 py-2 text-sm resize-none"
                      />
                      <div className="flex gap-2">
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
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
