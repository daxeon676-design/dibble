"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReorderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onReorder() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/orders/${orderId}/reorder`, { method: "POST" });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Could not add items to cart.");
      return;
    }

    router.push("/buyer/cart");
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void onReorder()}
        disabled={loading}
        className="text-xs border border-(--accent-terra)/40 rounded px-3 py-1.5 hover:bg-(--accent-beige)/60 disabled:opacity-60"
      >
        {loading ? "Reordering..." : "Reorder"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
