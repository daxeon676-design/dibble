"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type PayoutStatus = {
  stripeEnabled: boolean;
  hasConnectAccount: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  detailsSubmitted: boolean;
  payoutProfile?: {
    method?: "STRIPE_CONNECT" | "BANK_TRANSFER" | "PAYPAL" | "MANUAL_REVIEW";
    payeeName?: string;
    payoutEmail?: string;
    bankName?: string;
    bankAccountLast4?: string;
    bankSortCodeLast2?: string;
    paypalEmail?: string;
    notes?: string;
  };
};

const PAYOUTS_UI_VERSION = "seller-payouts-ui-2026-03-30-4";

async function getApiPayload(response: Response): Promise<{ url?: string; error?: string } | PayoutStatus | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => null)) as { url?: string; error?: string } | PayoutStatus | null;
  }

  const text = await response.text().catch(() => "");
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  return {
    error: trimmed.slice(0, 240),
  };
}

function getApiErrorMessage(response: Response, payload: { error?: string } | null, fallback: string) {
  if (payload?.error?.trim()) {
    return payload.error.trim();
  }

  if (response.redirected && response.url.includes("/login")) {
    return "Your session has expired. Refresh the page and sign in again.";
  }

  if (response.status === 401) {
    return "Your session has expired. Refresh the page and sign in again.";
  }

  if (response.status === 403) {
    return "Your account is not allowed to perform this payout action.";
  }

  if (response.status === 429) {
    return "Too many payout requests. Please wait a moment and try again.";
  }

  if (!response.ok) {
    return `${fallback} (HTTP ${response.status})`;
  }

  return fallback;
}

export function SellerPayoutsPanel() {
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"onboard" | "dashboard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [method, setMethod] = useState<"STRIPE_CONNECT" | "BANK_TRANSFER" | "PAYPAL" | "MANUAL_REVIEW">("STRIPE_CONNECT");
  const [payeeName, setPayeeName] = useState("");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountLast4, setBankAccountLast4] = useState("");
  const [bankSortCodeLast2, setBankSortCodeLast2] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [lastApiDebug, setLastApiDebug] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    setLastApiDebug(null);
    try {
      const response = await fetch("/api/seller/payouts");
      const payload = await getApiPayload(response);
      if (!response.ok) {
        setLastApiDebug(
          `load_status failed: HTTP ${response.status}, content-type=${response.headers.get("content-type") ?? "unknown"}, redirected=${String(response.redirected)}`,
        );
        throw new Error(getApiErrorMessage(response, payload as { error?: string } | null, "Could not load payout status."));
      }
      const nextStatus = payload as PayoutStatus;
      setStatus(nextStatus);
      setMethod(nextStatus.payoutProfile?.method ?? "STRIPE_CONNECT");
      setPayeeName(nextStatus.payoutProfile?.payeeName ?? "");
      setPayoutEmail(nextStatus.payoutProfile?.payoutEmail ?? "");
      setBankName(nextStatus.payoutProfile?.bankName ?? "");
      setBankAccountLast4(nextStatus.payoutProfile?.bankAccountLast4 ?? "");
      setBankSortCodeLast2(nextStatus.payoutProfile?.bankSortCodeLast2 ?? "");
      setPaypalEmail(nextStatus.payoutProfile?.paypalEmail ?? "");
      setNotes(nextStatus.payoutProfile?.notes ?? "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load payout status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function startOnboarding() {
    setBusyAction("onboard");
    setError(null);
    setLastApiDebug(null);

    try {
      const response = await fetch("/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_onboarding" }),
      });

      const payload = (await getApiPayload(response)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) {
        setLastApiDebug(
          `start_onboarding failed: HTTP ${response.status}, hasUrl=${String(Boolean(payload?.url))}, payloadError=${payload?.error?.slice(0, 180) ?? "none"}, content-type=${response.headers.get("content-type") ?? "unknown"}, redirected=${String(response.redirected)}`,
        );
        throw new Error(getApiErrorMessage(response, payload, "Could not create onboarding link."));
      }

      window.location.href = payload.url;
    } catch (requestError) {
      if (requestError instanceof Error) {
        setLastApiDebug((prev) => prev ?? `start_onboarding exception: ${requestError.message}`);
      } else {
        setLastApiDebug((prev) => prev ?? "start_onboarding exception: unknown non-Error thrown");
      }
      setError(requestError instanceof Error ? requestError.message : "Could not start onboarding.");
    } finally {
      setBusyAction(null);
    }
  }

  async function openExpressDashboard() {
    setBusyAction("dashboard");
    setError(null);
    setLastApiDebug(null);

    try {
      const response = await fetch("/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_dashboard" }),
      });

      const payload = (await getApiPayload(response)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) {
        setLastApiDebug(
          `open_dashboard failed: HTTP ${response.status}, hasUrl=${String(Boolean(payload?.url))}, payloadError=${payload?.error?.slice(0, 180) ?? "none"}, content-type=${response.headers.get("content-type") ?? "unknown"}, redirected=${String(response.redirected)}`,
        );
        throw new Error(getApiErrorMessage(response, payload, "Could not open Stripe dashboard."));
      }

      window.location.href = payload.url;
    } catch (requestError) {
      if (requestError instanceof Error) {
        setLastApiDebug((prev) => prev ?? `open_dashboard exception: ${requestError.message}`);
      } else {
        setLastApiDebug((prev) => prev ?? "open_dashboard exception: unknown non-Error thrown");
      }
      setError(requestError instanceof Error ? requestError.message : "Could not open Stripe dashboard.");
    } finally {
      setBusyAction(null);
    }
  }

  async function savePayoutProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    setSaveMessage(null);
    setLastApiDebug(null);

    try {
      const response = await fetch("/api/seller/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          method,
          payeeName,
          payoutEmail,
          bankName,
          bankAccountLast4,
          bankSortCodeLast2,
          paypalEmail,
          notes,
        }),
      });

      const payload = (await getApiPayload(response)) as { error?: string } | null;
      if (!response.ok) {
        setLastApiDebug(
          `update_profile failed: HTTP ${response.status}, payloadError=${payload?.error?.slice(0, 180) ?? "none"}, content-type=${response.headers.get("content-type") ?? "unknown"}, redirected=${String(response.redirected)}`,
        );
        throw new Error(getApiErrorMessage(response, payload, "Could not save payout details."));
      }

      setSaveMessage("Payout details saved.");
      await loadStatus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save payout details.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-(--accent-terra)/25 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-(--accent-terra)">Seller Payouts</h2>
          <p className="mt-1 text-sm text-foreground/70">
            Connect Stripe once to receive payouts automatically when orders are paid.
          </p>
          <p className="mt-2 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-mono font-semibold text-blue-800">
            {PAYOUTS_UI_VERSION} — <a href="/api/seller/payouts/debug" target="_blank" rel="noopener" className="underline">stripe debug</a>
          </p>
        </div>
        <button
          type="button"
          onClick={loadStatus}
          disabled={loading}
          className="rounded-md border border-(--accent-terra)/40 px-3 py-1.5 text-xs font-semibold text-(--accent-terra)"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {lastApiDebug ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {lastApiDebug}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/25" />
      ) : status ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatusChip label="Stripe" ok={status.stripeEnabled} okText="Configured" badText="Missing keys" />
            <StatusChip label="Connect Account" ok={status.hasConnectAccount} okText="Created" badText="Not created" />
            <StatusChip label="Charge Capability" ok={status.chargesEnabled} okText="Enabled" badText="Pending" />
            <StatusChip label="Payout Capability" ok={status.payoutsEnabled} okText="Enabled" badText="Pending" />
          </div>

          <div className="rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Seller Checklist</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-foreground/75">
              <li>Complete Stripe onboarding for automatic payouts.</li>
              <li>Provide legal payee name and contact payout email.</li>
              <li>If using bank transfer fallback, provide bank name + last 4 account digits + last 2 sort code digits.</li>
              <li>If using PayPal fallback, provide PayPal receiving email.</li>
            </ul>
          </div>

          <p className="text-sm text-foreground/70">
            {status.onboardingComplete
              ? "Payout setup complete. New paid orders can split at charge time."
              : "Finish Stripe onboarding to enable automatic seller payouts."}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startOnboarding}
              disabled={busyAction !== null || !status.stripeEnabled}
              className="rounded-md bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busyAction === "onboard"
                ? "Opening..."
                : status.hasConnectAccount
                  ? "Continue Stripe Setup"
                  : "Set Up Payouts"}
            </button>

            {status.hasConnectAccount ? (
              <button
                type="button"
                onClick={openExpressDashboard}
                disabled={busyAction !== null || !status.stripeEnabled}
                className="rounded-md border border-(--accent-terra)/40 px-4 py-2 text-sm font-semibold text-(--accent-terra) disabled:opacity-60"
              >
                {busyAction === "dashboard" ? "Opening..." : "Open Stripe Dashboard"}
              </button>
            ) : null}

            <a
              href="/seller/payouts-help"
              className="rounded-md border border-(--accent-terra)/40 px-4 py-2 text-sm font-semibold text-(--accent-terra)"
            >
              Read Payout Guide
            </a>
          </div>

          <form onSubmit={savePayoutProfile} className="mt-4 rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/15 p-3">
            <h3 className="text-sm font-semibold text-(--accent-terra)">Manual payout details</h3>
            <p className="mt-1 text-xs text-foreground/60">Used by admin when manual payouts are required.</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground/60">Method</span>
                <select value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm">
                  <option value="STRIPE_CONNECT">Stripe Connect</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="MANUAL_REVIEW">Manual review</option>
                </select>
              </label>

              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground/60">Payee name</span>
                <input value={payeeName} onChange={(event) => setPayeeName(event.target.value)} className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm" />
              </label>

              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground/60">Payout email</span>
                <input type="email" value={payoutEmail} onChange={(event) => setPayoutEmail(event.target.value)} className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm" />
              </label>

              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground/60">PayPal email</span>
                <input type="email" value={paypalEmail} onChange={(event) => setPaypalEmail(event.target.value)} className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm" />
              </label>

              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground/60">Bank name</span>
                <input value={bankName} onChange={(event) => setBankName(event.target.value)} className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm" />
              </label>

              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground/60">Bank account last 4</span>
                <input value={bankAccountLast4} onChange={(event) => setBankAccountLast4(event.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm" />
              </label>

              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground/60">Sort code last 2</span>
                <input value={bankSortCodeLast2} onChange={(event) => setBankSortCodeLast2(event.target.value.replace(/\D/g, "").slice(0, 2))} className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm" />
              </label>
            </div>

            <label className="mt-2 block text-xs">
              <span className="mb-1 block font-semibold uppercase tracking-wide text-foreground/60">Notes</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full rounded-md border border-(--accent-terra)/30 bg-white px-2 py-2 text-sm" />
            </label>

            <div className="mt-3 flex items-center gap-3">
              <button type="submit" disabled={savingProfile} className="rounded-md bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {savingProfile ? "Saving..." : "Save payout details"}
              </button>
              {saveMessage ? <p className="text-xs text-emerald-700">{saveMessage}</p> : null}
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function StatusChip({
  label,
  ok,
  okText,
  badText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <div className="rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/20 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/55">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${ok ? "text-green-700" : "text-amber-700"}`}>{ok ? okText : badText}</p>
    </div>
  );
}
