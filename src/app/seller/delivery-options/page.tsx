"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Option = { id: string; name: string; costPence: number; enabled: boolean };

export default function SellerDeliveryOptionsPage() {
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/seller/delivery-options")
      .then((r) => r.json())
      .then((data: { available: Option[]; selected: string[] }) => {
        setOptions(data.available ?? []);
        setSelected(data.selected ?? []);
      });
  }, []);

  async function save() {
    const response = await fetch("/api/seller/delivery-options", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionIds: selected }),
    });
    setMessage(response.ok ? "Saved" : "Could not save");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-slate-900">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Delivery Options</h1>
        <Link href="/seller" className="rounded border border-slate-300 px-3 py-2 text-sm">Back to Seller Dashboard</Link>
      </div>

      <div className="space-y-3 rounded border border-slate-200 bg-white p-5">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
            <span className="text-sm">{opt.name} (£{(opt.costPence / 100).toFixed(2)})</span>
            <input
              type="checkbox"
              checked={selected.includes(opt.id)}
              onChange={(e) => {
                setSelected((prev) =>
                  e.target.checked ? [...new Set([...prev, opt.id])] : prev.filter((id) => id !== opt.id),
                );
              }}
            />
          </label>
        ))}

        <button type="button" onClick={save} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save Delivery Options</button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </main>
  );
}
