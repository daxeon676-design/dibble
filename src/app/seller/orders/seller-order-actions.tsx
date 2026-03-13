"use client";

import { useState } from "react";

const statuses = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

type Props = {
  orderId: string;
};

export function SellerOrderActions({ orderId }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function setStatus(status: (typeof statuses)[number]) {
    setState("loading");
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          disabled={state === "loading"}
          onClick={() => setStatus(status)}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs"
        >
          {status}
        </button>
      ))}
      {state === "error" ? <span className="text-xs text-red-300">Update failed</span> : null}
    </div>
  );
}
