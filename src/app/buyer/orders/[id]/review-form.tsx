"use client";

import { FormEvent, useState } from "react";

type ExistingReview = { rating: number; body: string } | null;

type Props = {
  productId: string;
  productTitle: string;
  existingReview: ExistingReview;
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl leading-none focus:outline-none"
          aria-label={star + " star"}
        >
          <span className={(hovered || value) >= star ? "text-amber-400" : "text-foreground/20"}>
            &#9733;
          </span>
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({ productId, productTitle, existingReview }: Props) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [body, setBody] = useState(existingReview?.body ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitted, setSubmitted] = useState(!!existingReview);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) { setErrorMsg("Please select a star rating."); return; }
    setStatus("saving");
    setErrorMsg("");
    const res = await fetch("/api/products/" + productId + "/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, body }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      setErrorMsg(json.error ?? "Could not save review.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    setSubmitted(true);
  }

  if (submitted && status !== "saving") {
    return (
      <div className="rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/20 p-4">
        <p className="text-sm font-medium">{productTitle}</p>
        <div className="mt-1 flex gap-0.5">
          {[1,2,3,4,5].map((s) => (
            <span key={s} className={s <= rating ? "text-amber-400" : "text-foreground/20"}>&#9733;</span>
          ))}
        </div>
        <p className="mt-1 text-sm text-foreground/70">{body}</p>
        <button
          type="button"
          onClick={() => { setSubmitted(false); setStatus("idle"); }}
          className="mt-2 text-xs text-(--accent-terra) underline underline-offset-2"
        >
          Edit review
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/20 p-4 space-y-3">
      <p className="text-sm font-medium">{productTitle}</p>
      <div>
        <p className="text-xs text-foreground/60 mb-1">Your rating</p>
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <label className="block text-sm">
        <span className="text-foreground/70">Your review</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={10}
          maxLength={1000}
          required
          rows={3}
          className="mt-1 w-full rounded border border-(--accent-terra)/40 bg-white px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          placeholder="Share your experience with this product..."
        />
      </label>
      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-md bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : existingReview ? "Update Review" : "Submit Review"}
      </button>
    </form>
  );
}