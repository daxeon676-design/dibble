"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FormEvent, useState } from "react";

import { HumanVerification } from "@/app/components/human-verification";

type ApplicationConfig = {
  allowNewSellerApplications: boolean;
  maxActiveSellerAccounts: number;
  activeSellerCount: number;
  capacityReached: boolean;
};

export default function SellerApplicationPage() {
  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [planToSell, setPlanToSell] = useState("");
  const [sellerTermsAccepted, setSellerTermsAccepted] = useState(false);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [humanVerificationToken, setHumanVerificationToken] = useState<string | null>(null);
  const [verificationResetSignal, setVerificationResetSignal] = useState(0);
  const [applicationConfig, setApplicationConfig] = useState<ApplicationConfig | null>(null);

  useEffect(() => {
    fetch("/api/seller-applications")
      .then((res) => res.json())
      .then((data: { applicationConfig?: ApplicationConfig }) => {
        if (data.applicationConfig) {
          setApplicationConfig(data.applicationConfig);
        }
      })
      .catch(() => {
        setApplicationConfig(null);
      });
  }, []);

  const submissionsOpen =
    applicationConfig
      ? applicationConfig.allowNewSellerApplications && !applicationConfig.capacityReached
      : true;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/seller-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName,
        description,
        businessType,
        businessAddress,
        vatNumber: vatNumber || undefined,
        planToSell,
        sellerTermsAccepted,
        confirmedAdult,
        humanVerificationToken,
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(`${body?.error ?? "Could not submit application."} Please complete human verification again.`);
      setHumanVerificationToken(null);
      setVerificationResetSignal((v) => v + 1);
      return;
    }

    setMessage("Application submitted. An admin will review it shortly.");
    setShopName("");
    setDescription("");
    setBusinessType("");
    setBusinessAddress("");
    setVatNumber("");
    setPlanToSell("");
    setSellerTermsAccepted(false);
    setConfirmedAdult(false);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-foreground">
      <h1 className="text-3xl font-semibold">Apply to Become a Seller</h1>
      <p className="mt-2 text-sm text-foreground/70">Tell us about your shop and what you make.</p>

      {applicationConfig ? (
        <div className="mt-4 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Active seller accounts: {applicationConfig.activeSellerCount}/{applicationConfig.maxActiveSellerAccounts}
          </p>
          {!submissionsOpen ? (
            <p className="mt-1 text-amber-700">
              New seller applications are currently unavailable.
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-(--accent-terra) bg-(--accent-beige) p-6">
        <label className="block text-sm">
          <span>Shop name</span>
          <input
            type="text"
            required
            minLength={3}
            maxLength={80}
            value={shopName}
            onChange={(event) => setShopName(event.target.value)}
            className="mt-1 w-full rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 text-foreground"
          />
        </label>

        <label className="block text-sm">
          <span>Description — tell us about your shop and what you make</span>
          <textarea
            required
            minLength={20}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 min-h-36 w-full rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 text-foreground"
          />
        </label>

        <label className="block text-sm">
          <span>Business type <span className="text-red-500">*</span></span>
          <select
            required
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="mt-1 w-full rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 text-foreground"
          >
            <option value="">Select…</option>
            <option value="sole_trader">Sole trader / self-employed</option>
            <option value="limited_company">Limited company</option>
            <option value="partnership">Partnership</option>
            <option value="individual">Individual (hobby seller)</option>
          </select>
        </label>

        <label className="block text-sm">
          <span>Trading address <span className="text-red-500">*</span></span>
          <textarea
            required
            minLength={5}
            maxLength={300}
            placeholder="Street, City, Postcode, Country"
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            className="mt-1 min-h-20 w-full rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 text-foreground"
          />
        </label>

        <label className="block text-sm">
          <span>VAT registration number <span className="text-foreground/50 text-xs">(optional — only if VAT registered)</span></span>
          <input
            type="text"
            maxLength={20}
            placeholder="GB123456789"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 text-foreground"
          />
        </label>

        <label className="block text-sm">
          <span>What do you plan to sell? <span className="text-red-500">*</span></span>
          <textarea
            required
            minLength={10}
            maxLength={500}
            placeholder="e.g. handmade ceramics, knitted goods, leather accessories..."
            value={planToSell}
            onChange={(e) => setPlanToSell(e.target.value)}
            className="mt-1 min-h-20 w-full rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 text-foreground"
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm">Human verification</p>
          <HumanVerification onTokenChange={setHumanVerificationToken} resetSignal={verificationResetSignal} />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            required
            checked={confirmedAdult}
            onChange={(e) => setConfirmedAdult(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>I confirm that I am 18 years of age or older.</span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            required
            checked={sellerTermsAccepted}
            onChange={(e) => setSellerTermsAccepted(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            I have read and agree to the{" "}
            <Link href="/terms" target="_blank" className="text-(--accent-terra) underline">Seller Terms &amp; Conditions</Link>.
            I understand Dibble acts as marketplace facilitator and that I am responsible for my listings and fulfilment.
          </span>
        </label>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}

        <button
          type="submit"
          disabled={loading || !submissionsOpen || !humanVerificationToken || !sellerTermsAccepted || !confirmedAdult}
          className="rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige) disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </main>
  );
}
