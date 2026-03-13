"use client";

import { useState } from "react";

type Props = {
  reviewId: string;
};

export function DeleteReviewButton({ reviewId }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function removeReview() {
    setState("loading");
    const response = await fetch(`/api/admin/reviews/${reviewId}`, { method: "DELETE" });

    if (!response.ok) {
      setState("error");
      return;
    }

    setState("done");
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={removeReview}
      disabled={state === "loading"}
      className="rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
    >
      {state === "loading" ? "Removing..." : "Delete Review"}
    </button>
  );
}