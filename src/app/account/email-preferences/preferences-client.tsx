"use client";

import Link from "next/link";
import { useState } from "react";

type Preferences = {
  marketingOptIn: boolean;
  accountUpdates: boolean;
  orderUpdates: boolean;
  disputeUpdates: boolean;
  returnUpdates: boolean;
  productAnnouncements: boolean;
  sellerProductUpdates: boolean;
};

export default function EmailPreferencesClient({
  callbackRole,
  initialPreferences,
}: {
  callbackRole: "BUYER" | "SELLER" | "ADMIN";
  initialPreferences: Preferences;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const callbackPath = callbackRole === "ADMIN" ? "/admin" : callbackRole === "SELLER" ? "/seller" : "/buyer";

  async function savePreferences(next: Preferences) {
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/account/email-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; preferences?: Preferences }
      | null;

    if (!response.ok || !payload?.preferences) {
      setMessage(payload?.error ?? "Could not save preferences.");
      setSaving(false);
      return;
    }

    setPrefs(payload.preferences);
    setMessage("Email preferences updated.");
    setSaving(false);
  }

  function toggle<K extends keyof Preferences>(key: K) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    void savePreferences(next);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-foreground">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Email Preferences</h1>
        <Link href={callbackPath} className="rounded border border-(--accent-terra)/40 px-3 py-2 text-sm hover:bg-(--accent-beige)/40">
          Back
        </Link>
      </div>

      <div className="space-y-3 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/30 p-5">
        <PreferenceToggle
          label="Marketing emails"
          description="News, launches, and marketplace updates."
          value={prefs.marketingOptIn}
          disabled={saving}
          onToggle={() => toggle("marketingOptIn")}
        />
        <PreferenceToggle
          label="Account updates"
          description="Welcome emails, seller application decisions, and other non-security account notices."
          value={prefs.accountUpdates}
          disabled={saving}
          onToggle={() => toggle("accountUpdates")}
        />
        <PreferenceToggle
          label="Order updates"
          description="Payment confirmation, shipment changes, and delivery notices."
          value={prefs.orderUpdates}
          disabled={saving}
          onToggle={() => toggle("orderUpdates")}
        />
        <PreferenceToggle
          label="Dispute updates"
          description="Messages and resolution status updates for disputes."
          value={prefs.disputeUpdates}
          disabled={saving}
          onToggle={() => toggle("disputeUpdates")}
        />
        <PreferenceToggle
          label="Return updates"
          description="Status updates for return requests and refund progress."
          value={prefs.returnUpdates}
          disabled={saving}
          onToggle={() => toggle("returnUpdates")}
        />
        <PreferenceToggle
          label="Product announcements"
          description="Alerts about new products from followed shops."
          value={prefs.productAnnouncements}
          disabled={saving}
          onToggle={() => toggle("productAnnouncements")}
        />
        <PreferenceToggle
          label="Seller product lifecycle"
          description="Renewal reminders and removal notices for your own product listings."
          value={prefs.sellerProductUpdates}
          disabled={saving}
          onToggle={() => toggle("sellerProductUpdates")}
        />
      </div>

      {message ? <p className="mt-4 text-sm text-foreground/70">{message}</p> : null}
    </main>
  );
}

function PreferenceToggle({
  label,
  description,
  value,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="flex w-full items-start justify-between rounded border border-(--accent-terra)/20 bg-white px-4 py-3 text-left disabled:opacity-60"
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-foreground/60">{description}</span>
      </span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${value ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
        {value ? "On" : "Off"}
      </span>
    </button>
  );
}
