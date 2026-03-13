"use client";

import { useState } from "react";

type Props = {
  applicationId: string;
};

export function ReviewActions({ applicationId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: "APPROVE" | "REJECT") {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/admin/seller-applications/${applicationId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });

    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Review failed.");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => review("APPROVE")}
        className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => review("REJECT")}
        className="rounded-md bg-red-500 px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
      >
        Reject
      </button>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </div>
  );
}
