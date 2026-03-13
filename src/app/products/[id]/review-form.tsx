"use client";

import { FormEvent, useState } from "react";

type Props = {
  productId: string;
};

export function ReviewForm({ productId }: Props) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setError(null);

    const response = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, body }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setState("error");
      setError(payload?.error ?? "Could not save review.");
      return;
    }

    setState("done");
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-(--accent-terra)/30 bg-white p-4">
      <h3 className="text-lg font-semibold text-foreground">Leave a Review</h3>

      <label className="block text-sm text-foreground">
        <span>Rating</span>
        <select
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>{value} / 5</option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-foreground">
        <span>Your review</span>
        <textarea
          required
          minLength={10}
          maxLength={1000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-1 min-h-28 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {state === "done" ? <p className="text-sm text-green-700">Review saved.</p> : null}

      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-md bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-(--accent-beige) disabled:opacity-60"
      >
        {state === "loading" ? "Saving..." : "Submit Review"}
      </button>
    </form>
  );
}