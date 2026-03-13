"use client";

import { useEffect, useState } from "react";

type DeliveryOption = { id: string; name: string; costPence: number; enabled: boolean };
type Config = {
  categories: string[];
  deliveryOptions: DeliveryOption[];
  homepageTagline: string;
  footerDescription: string;
  platformFeePercent: number;
  supportEmail: string;
  allowNewSellerApplications: boolean;
};

export default function SiteSettingsClient() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-config")
      .then((r) => r.json())
      .then((data: Config) => setConfig(data));
  }, []);

  if (!config) return <p>Loading...</p>;

  function updateDelivery(index: number, patch: Partial<DeliveryOption>) {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = [...prev.deliveryOptions];
      next[index] = { ...next[index], ...patch };
      return { ...prev, deliveryOptions: next };
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    setSaving(false);
    setMessage(response.ok ? "Saved" : "Failed to save");
  }

  return (
    <div className="space-y-6 rounded-md border border-slate-200 bg-white p-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Homepage Text</h2>
        <label className="block text-sm text-slate-700">
          Homepage tagline
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={config.homepageTagline}
            onChange={(e) => setConfig({ ...config, homepageTagline: e.target.value })}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Footer description
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={config.footerDescription}
            onChange={(e) => setConfig({ ...config, footerDescription: e.target.value })}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
        <p className="text-xs text-slate-500">Comma-separated list</p>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2"
          value={config.categories.join(", ")}
          onChange={(e) =>
            setConfig({
              ...config,
              categories: e.target.value
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean),
            })
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Marketplace Fees</h2>
        <label className="block text-sm text-slate-700">
          Platform fee percent (applied before card fees)
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={config.platformFeePercent}
            onChange={(e) => setConfig({ ...config, platformFeePercent: Number(e.target.value || 0) })}
          />
        </label>
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          Warning: Changing this affects seller payouts and revenue analytics for future sales.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Operational Settings</h2>
        <label className="block text-sm text-slate-700">
          Support email
          <input
            type="email"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={config.supportEmail}
            onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.allowNewSellerApplications}
            onChange={(e) => setConfig({ ...config, allowNewSellerApplications: e.target.checked })}
          />
          Allow new seller applications
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Delivery Options</h2>
        {config.deliveryOptions.map((opt, i) => (
          <div key={opt.id} className="grid grid-cols-1 gap-2 rounded border border-slate-200 p-3 md:grid-cols-4">
            <input
              className="rounded border border-slate-300 px-2 py-1"
              value={opt.id}
              onChange={(e) => updateDelivery(i, { id: e.target.value })}
              placeholder="id"
            />
            <input
              className="rounded border border-slate-300 px-2 py-1"
              value={opt.name}
              onChange={(e) => updateDelivery(i, { name: e.target.value })}
              placeholder="name"
            />
            <input
              type="number"
              min={0}
              className="rounded border border-slate-300 px-2 py-1"
              value={(opt.costPence / 100).toFixed(2)}
              onChange={(e) =>
                updateDelivery(i, {
                  costPence: Math.round(Number(e.target.value || "0") * 100),
                })
              }
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={opt.enabled}
                onChange={(e) => updateDelivery(i, { enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setConfig({
              ...config,
              deliveryOptions: [
                ...config.deliveryOptions,
                { id: "new-option", name: "New Option", costPence: 0, enabled: true },
              ],
            })
          }
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          Add Delivery Option
        </button>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </div>
  );
}
