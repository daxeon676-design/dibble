"use client";

import { useEffect, useRef, useState } from "react";

type DeliveryOption = { id: string; name: string; costPence: number; enabled: boolean };
type PendingChange = { value: number; effectiveAt: string } | null;
type Config = {
  categories: string[];
  deliveryOptions: DeliveryOption[];
  homepageTagline: string;
  footerDescription: string;
  platformFeePercent: number;
  supportEmail: string;
  allowNewSellerApplications: boolean;
  maxActiveSellerAccounts: number;
  maintenanceMode: boolean;
  checkoutPaused: boolean;
  newAccountsPaused: boolean;
  pendingFeeChange: PendingChange;
  pendingSellerLimitChange: PendingChange;
};

type HistoryEntry = { savedAt: string; savedBy: string; config: Config };

// ─── helpers ─────────────────────────────────────────────────────────────────

function findDuplicateCategories(cats: string[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const c of cats) {
    const key = c.trim().toLowerCase();
    if (seen.has(key)) dupes.push(c.trim());
    else seen.add(key);
  }
  return dupes;
}

function buildDiff(original: Config, next: Config): string[] {
  const lines: string[] = [];
  if (original.platformFeePercent !== next.platformFeePercent)
    lines.push(`Platform fee: ${original.platformFeePercent}% → ${next.platformFeePercent}%`);
  if (original.maxActiveSellerAccounts !== next.maxActiveSellerAccounts)
    lines.push(`Seller cap: ${original.maxActiveSellerAccounts} → ${next.maxActiveSellerAccounts}`);
  if (original.supportEmail !== next.supportEmail)
    lines.push(`Support email: ${original.supportEmail} → ${next.supportEmail}`);
  if (original.allowNewSellerApplications !== next.allowNewSellerApplications)
    lines.push(`Seller applications: ${original.allowNewSellerApplications ? "open" : "paused"} → ${next.allowNewSellerApplications ? "open" : "paused"}`);
  if (original.maintenanceMode !== next.maintenanceMode)
    lines.push(`Maintenance mode: ${original.maintenanceMode ? "ON" : "OFF"} → ${next.maintenanceMode ? "ON" : "OFF"}`);
  if (original.checkoutPaused !== next.checkoutPaused)
    lines.push(`Checkout: ${original.checkoutPaused ? "paused" : "active"} → ${next.checkoutPaused ? "paused" : "active"}`);
  if (original.newAccountsPaused !== next.newAccountsPaused)
    lines.push(`New registrations: ${original.newAccountsPaused ? "paused" : "open"} → ${next.newAccountsPaused ? "paused" : "open"}`);
  if (original.homepageTagline !== next.homepageTagline) lines.push("Homepage tagline changed");
  if (original.footerDescription !== next.footerDescription) lines.push("Footer description changed");
  if (JSON.stringify(original.categories) !== JSON.stringify(next.categories))
    lines.push(`Categories updated (${next.categories.length} total)`);
  if (JSON.stringify(original.deliveryOptions) !== JSON.stringify(next.deliveryOptions))
    lines.push("Delivery options updated");
  if (JSON.stringify(original.pendingFeeChange) !== JSON.stringify(next.pendingFeeChange))
    lines.push(
      next.pendingFeeChange
        ? `Scheduled fee change to ${next.pendingFeeChange.value}% at ${new Date(next.pendingFeeChange.effectiveAt).toLocaleString("en-GB")}`
        : "Scheduled fee change removed",
    );
  if (JSON.stringify(original.pendingSellerLimitChange) !== JSON.stringify(next.pendingSellerLimitChange))
    lines.push(
      next.pendingSellerLimitChange
        ? `Scheduled seller cap to ${next.pendingSellerLimitChange.value} at ${new Date(next.pendingSellerLimitChange.effectiveAt).toLocaleString("en-GB")}`
        : "Scheduled seller cap change removed",
    );
  return lines;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function SiteSettingsClient() {
  const [config, setConfig] = useState<Config | null>(null);
  const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diff, setDiff] = useState<string[]>([]);
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const [scheduleFeeValue, setScheduleFeeValue] = useState("");
  const [scheduleFeeDate, setScheduleFeeDate] = useState("");
  const [scheduleCapValue, setScheduleCapValue] = useState("");
  const [scheduleCapDate, setScheduleCapDate] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/site-config")
      .then((r) => r.json())
      .then((data: Config) => {
        setConfig(data);
        setOriginalConfig(data);
      });
    fetch("/api/admin/site-config/history")
      .then((r) => r.json())
      .then((data: HistoryEntry[]) => setHistory(Array.isArray(data) ? data : []));
  }, []);

  if (!config) return <p className="text-sm text-slate-500">Loading…</p>;

  function updateDelivery(index: number, patch: Partial<DeliveryOption>) {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = [...prev.deliveryOptions];
      next[index] = { ...next[index], ...patch };
      return { ...prev, deliveryOptions: next };
    });
  }

  function requestSave() {
    if (!config || !originalConfig) return;
    const dupes = findDuplicateCategories(config.categories);
    if (dupes.length > 0) {
      setMessage({ text: `Duplicate categories: ${dupes.join(", ")}`, ok: false });
      return;
    }
    const changes = buildDiff(originalConfig, config);
    if (changes.length === 0) {
      setMessage({ text: "No changes to save", ok: true });
      return;
    }
    setDiff(changes);
    setShowDiff(true);
  }

  async function confirmSave() {
    if (!config) return;
    setShowDiff(false);
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    if (response.ok) {
      setOriginalConfig(config);
      setMessage({ text: "Settings saved", ok: true });
      fetch("/api/admin/site-config/history")
        .then((r) => r.json())
        .then((data: HistoryEntry[]) => setHistory(Array.isArray(data) ? data : []));
    } else {
      setMessage({ text: "Failed to save – check the values and try again", ok: false });
    }
  }

  async function rollback(index: number) {
    setRollingBack(index);
    const response = await fetch("/api/admin/site-config/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    setRollingBack(null);
    if (response.ok) {
      const fresh: Config = await fetch("/api/admin/site-config").then((r) => r.json());
      setConfig(fresh);
      setOriginalConfig(fresh);
      setMessage({ text: "Rolled back successfully", ok: true });
      fetch("/api/admin/site-config/history")
        .then((r) => r.json())
        .then((data: HistoryEntry[]) => setHistory(Array.isArray(data) ? data : []));
    } else {
      setMessage({ text: "Rollback failed", ok: false });
    }
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importConfig(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Config;
        if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.deliveryOptions)) {
          setMessage({ text: "Invalid config file — missing required fields", ok: false });
          return;
        }
        setConfig(parsed);
        setMessage({ text: "Config imported — review changes and save to apply", ok: true });
      } catch {
        setMessage({ text: "Could not parse config file", ok: false });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function addScheduledFeeChange() {
    const value = parseFloat(scheduleFeeValue);
    if (!Number.isFinite(value) || value < 0 || value > 100 || !scheduleFeeDate) return;
    setConfig((prev) =>
      prev ? { ...prev, pendingFeeChange: { value, effectiveAt: new Date(scheduleFeeDate).toISOString() } } : prev,
    );
    setScheduleFeeValue("");
    setScheduleFeeDate("");
  }

  function addScheduledCapChange() {
    const value = parseInt(scheduleCapValue, 10);
    if (!Number.isFinite(value) || value < 1 || !scheduleCapDate) return;
    setConfig((prev) =>
      prev ? { ...prev, pendingSellerLimitChange: { value, effectiveAt: new Date(scheduleCapDate).toISOString() } } : prev,
    );
    setScheduleCapValue("");
    setScheduleCapDate("");
  }

  return (
    <div className="space-y-8">

      {/* ── top toolbar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportConfig}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Import JSON
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={importConfig} />
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {showHistory ? "Hide" : "Show"} history ({history.length})
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={requestSave}
            disabled={saving}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {message ? (
            <p className={`text-sm font-medium ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
              {message.text}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── change-diff confirmation dialog ──────────────────────────────── */}
      {showDiff ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Review changes before saving:</p>
          <ul className="mb-4 list-inside list-disc space-y-1 text-sm text-amber-800">
            {diff.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmSave}
              className="rounded bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Confirm &amp; Save
            </button>
            <button
              type="button"
              onClick={() => setShowDiff(false)}
              className="rounded border border-amber-300 px-3 py-1.5 text-sm text-amber-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* ── change history ─────────────────────────────────────────────── */}
      {showHistory ? (
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Change History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No history yet — changes will appear here after the first save.</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry, i) => (
                <div
                  key={`${entry.savedAt}-${i}`}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {new Date(entry.savedAt).toLocaleString("en-GB")}
                    </p>
                    <p className="text-xs text-slate-500">Saved by {entry.savedBy}</p>
                    <p className="text-xs text-slate-400">
                      Fee: {entry.config.platformFeePercent}% · Cap: {entry.config.maxActiveSellerAccounts} · {entry.config.categories.length} categories
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={rollingBack !== null}
                    onClick={() => rollback(i)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {rollingBack === i ? "Restoring…" : "Restore"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div className="space-y-6 rounded-md border border-slate-200 bg-white p-6">

        {/* ── Operational Controls ──────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Operational Controls</h2>
          <p className="text-xs text-slate-500">
            Quick-switches for incidents and controlled launches. Changes take effect immediately on save.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${config.maintenanceMode ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
              <input
                type="checkbox"
                checked={config.maintenanceMode}
                onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Maintenance Mode</p>
                <p className="text-xs text-slate-500">Shows maintenance page to all non-admin visitors.</p>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${config.checkoutPaused ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
              <input
                type="checkbox"
                checked={config.checkoutPaused}
                onChange={(e) => setConfig({ ...config, checkoutPaused: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Pause Checkout</p>
                <p className="text-xs text-slate-500">Blocks new orders while preserving browsing.</p>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${config.newAccountsPaused ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
              <input
                type="checkbox"
                checked={config.newAccountsPaused}
                onChange={(e) => setConfig({ ...config, newAccountsPaused: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Pause Registrations</p>
                <p className="text-xs text-slate-500">Prevents new buyer and seller account creation.</p>
              </div>
            </label>
          </div>
          {(config.maintenanceMode || config.checkoutPaused || config.newAccountsPaused) ? (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-800">
              Active:{" "}
              {[
                config.maintenanceMode && "Maintenance mode",
                config.checkoutPaused && "Checkout paused",
                config.newAccountsPaused && "Registrations paused",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </section>

        {/* ── Homepage Text ─────────────────────────────────────────────── */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Homepage Text</h2>
          <label className="block text-sm text-slate-700">
            Homepage tagline
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              rows={2}
              value={config.homepageTagline}
              onChange={(e) => setConfig({ ...config, homepageTagline: e.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-700">
            Footer description
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              rows={2}
              value={config.footerDescription}
              onChange={(e) => setConfig({ ...config, footerDescription: e.target.value })}
            />
          </label>
        </section>

        {/* ── Categories ────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
          <p className="text-xs text-slate-500">Comma-separated · {config.categories.length} total</p>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
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
          {(() => {
            const dupes = findDuplicateCategories(config.categories);
            return dupes.length > 0 ? (
              <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                Duplicate categories detected: {dupes.join(", ")} — remove before saving.
              </p>
            ) : null;
          })()}
        </section>

        {/* ── Marketplace Fees ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Marketplace Fees</h2>
          <label className="block text-sm text-slate-700">
            Platform fee percent (applied before card fees)
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={config.platformFeePercent}
              onChange={(e) => setConfig({ ...config, platformFeePercent: Number(e.target.value || 0) })}
            />
          </label>
          <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            Warning: affects seller payouts for all future sales. Schedule the change below to apply it at a specific time.
          </p>
          {config.pendingFeeChange ? (
            <div className="flex items-center justify-between rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
              <span>
                Scheduled: {config.pendingFeeChange.value}% from{" "}
                {new Date(config.pendingFeeChange.effectiveAt).toLocaleString("en-GB")}
              </span>
              <button
                type="button"
                onClick={() => setConfig({ ...config, pendingFeeChange: null })}
                className="ml-3 text-sky-600 underline hover:text-sky-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Schedule a future fee change</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  placeholder="New % value"
                  className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                  value={scheduleFeeValue}
                  onChange={(e) => setScheduleFeeValue(e.target.value)}
                />
                <input
                  type="datetime-local"
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                  value={scheduleFeeDate}
                  onChange={(e) => setScheduleFeeDate(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addScheduledFeeChange}
                  className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                >
                  Schedule
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Seller Settings ───────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Seller Settings</h2>
          <label className="block text-sm text-slate-700">
            Support email
            <input
              type="email"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
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
          <label className="block text-sm text-slate-700">
            Maximum active seller accounts
            <input
              type="number"
              min={1}
              max={10000}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={config.maxActiveSellerAccounts}
              onChange={(e) => setConfig({ ...config, maxActiveSellerAccounts: Number(e.target.value || 1) })}
            />
          </label>
          <p className="text-xs text-slate-500">
            When the active seller count reaches this cap, new applications and approvals are blocked.
          </p>
          {config.pendingSellerLimitChange ? (
            <div className="flex items-center justify-between rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
              <span>
                Scheduled: cap → {config.pendingSellerLimitChange.value} from{" "}
                {new Date(config.pendingSellerLimitChange.effectiveAt).toLocaleString("en-GB")}
              </span>
              <button
                type="button"
                onClick={() => setConfig({ ...config, pendingSellerLimitChange: null })}
                className="ml-3 text-sky-600 underline hover:text-sky-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Schedule a future seller cap change</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="New cap"
                  className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                  value={scheduleCapValue}
                  onChange={(e) => setScheduleCapValue(e.target.value)}
                />
                <input
                  type="datetime-local"
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                  value={scheduleCapDate}
                  onChange={(e) => setScheduleCapDate(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addScheduledCapChange}
                  className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                >
                  Schedule
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Delivery Options ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Options</h2>
          {config.deliveryOptions.map((opt, i) => (
            <div key={opt.id} className="grid grid-cols-1 gap-2 rounded border border-slate-200 p-3 md:grid-cols-4">
              <input
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={opt.id}
                onChange={(e) => updateDelivery(i, { id: e.target.value })}
                placeholder="id"
              />
              <input
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={opt.name}
                onChange={(e) => updateDelivery(i, { name: e.target.value })}
                placeholder="name"
              />
              <input
                type="number"
                min={0}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={(opt.costPence / 100).toFixed(2)}
                onChange={(e) =>
                  updateDelivery(i, {
                    costPence: Math.round(Number(e.target.value || "0") * 100),
                  })
                }
              />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={opt.enabled}
                    onChange={(e) => updateDelivery(i, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      deliveryOptions: config.deliveryOptions.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setConfig({
                ...config,
                deliveryOptions: [
                  ...config.deliveryOptions,
                  { id: `option-${Date.now()}`, name: "New Option", costPence: 0, enabled: true },
                ],
              })
            }
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Add Delivery Option
          </button>
        </section>

      </div>

      {/* ── bottom save bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={requestSave}
          disabled={saving}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {message ? (
          <p className={`text-sm font-medium ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

