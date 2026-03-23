"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Option = { id: string; name: string; costPence: number; enabled: boolean };

type DeliverySettingsResponse = {
  available: Option[];
  selected: string[];
  customCostsPence?: Record<string, number>;
  freeDeliveryThresholdPence?: number;
};

export default function SellerDeliveryOptionsPage() {
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [customCostsPence, setCustomCostsPence] = useState<Record<string, number>>({});
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<string>("0.00");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/seller/delivery-options")
      .then((r) => r.json())
      .then((data: DeliverySettingsResponse) => {
        setOptions(data.available ?? []);
        setSelected(data.selected ?? []);
        setCustomCostsPence(data.customCostsPence ?? {});
        setFreeDeliveryThreshold(((data.freeDeliveryThresholdPence ?? 0) / 100).toFixed(2));
      });
  }, []);

  async function save() {
    const response = await fetch("/api/seller/delivery-options", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        optionIds: selected,
        customCostsPence,
        freeDeliveryThresholdPence: Math.max(0, Math.round(Number(freeDeliveryThreshold || "0") * 100)),
      }),
    });
    setMessage(response.ok ? "Saved" : "Could not save");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-foreground">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Delivery Options</h1>
        <Link href="/seller" className="rounded border border-(--accent-terra)/40 px-3 py-2 text-sm text-(--accent-terra)">Back to Seller Dashboard</Link>
      </div>

      <div className="space-y-4 rounded border border-(--accent-terra)/25 bg-white p-5">
        <label className="block text-sm">
          <span className="font-medium text-foreground">Free delivery threshold per seller (£)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={freeDeliveryThreshold}
            onChange={(event) => setFreeDeliveryThreshold(event.target.value)}
            className="mt-1 w-full rounded border border-(--accent-terra)/30 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-foreground/60">
            If a buyer spends at least this amount with your shop in one checkout, delivery for your shop becomes free.
          </span>
        </label>

        {options.map((opt) => (
          <div key={opt.id} className="rounded border border-(--accent-terra)/20 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked ? [...new Set([...prev, opt.id])] : prev.filter((id) => id !== opt.id),
                    );
                  }}
                />
                {opt.name}
              </label>

              <label className="text-sm">
                <span className="mr-2 text-foreground/70">Price (£)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={((customCostsPence[opt.id] ?? opt.costPence) / 100).toFixed(2)}
                  onChange={(event) => {
                    const pence = Math.max(0, Math.round(Number(event.target.value || "0") * 100));
                    setCustomCostsPence((prev) => ({ ...prev, [opt.id]: pence }));
                  }}
                  className="w-28 rounded border border-(--accent-terra)/30 px-2 py-1"
                />
              </label>
            </div>
            <p className="mt-1 text-xs text-foreground/55">Default platform price: £{(opt.costPence / 100).toFixed(2)}</p>
          </div>
        ))}

        <button type="button" onClick={save} className="rounded bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-(--accent-beige)">Save Delivery Options</button>
        {message ? <p className="text-sm text-foreground/70">{message}</p> : null}
      </div>
    </main>
  );
}
