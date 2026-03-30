"use client";

import { useState } from "react";

export function PurgeFailedOrdersButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  async function loadPreview() {
    setBusy(true);
    setResult(null);

    const previewResponse = await fetch("/api/admin/orders/purge-failed-preview", {
      method: "GET",
    });
    const previewBody = (await previewResponse.json().catch(() => null)) as
      | { error?: string; count?: number }
      | null;

    if (!previewResponse.ok) {
      setBusy(false);
      setResult(previewBody?.error ?? "Failed to load failed order preview.");
      return;
    }

    setPreviewCount(previewBody?.count ?? 0);
    setBusy(false);
  }

  async function executePurge() {
    setBusy(true);
    setResult(null);

    const response = await fetch("/api/admin/orders/purge-failed", { method: "DELETE" });
    const body = (await response.json().catch(() => null)) as
      | { deleted?: number; error?: string }
      | null;

    setBusy(false);
    if (!response.ok) {
      setResult(body?.error ?? "Failed to purge orders.");
      return;
    }
    setPreviewCount(null);
    setResult(`${body?.deleted ?? 0} failed/unpaid order(s) deleted.`);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void loadPreview()}
        className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-red-800"
      >
        {busy ? "Loading preview..." : "Preview Failed Orders Cleanup"}
      </button>
      {previewCount !== null ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-900">
            {previewCount} PENDING_PAYMENT order(s) will be permanently deleted.
          </p>
          <p className="mt-1 text-xs text-red-700">This action cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void executePurge()}
              disabled={busy}
              className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-red-800"
            >
              {busy ? "Purging..." : "Execute Deletion"}
            </button>
            <button
              type="button"
              onClick={() => setPreviewCount(null)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {result ? <p className="text-sm text-slate-300">{result}</p> : null}
    </div>
  );
}
