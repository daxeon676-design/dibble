"use client";

import { useEffect } from "react";
import { FormEvent, useState } from "react";

type ApplicationConfig = {
  allowNewSellerApplications: boolean;
  maxActiveSellerAccounts: number;
  activeSellerCount: number;
  capacityReached: boolean;
};

export default function SellerApplicationPage() {
  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      body: JSON.stringify({ shopName, description }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Could not submit application.");
      return;
    }

    setMessage("Application submitted. An admin will review it shortly.");
    setShopName("");
    setDescription("");
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
          <span>Description</span>
          <textarea
            required
            minLength={20}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 min-h-36 w-full rounded-md border border-(--accent-terra) bg-white/70 px-3 py-2 text-foreground"
          />
        </label>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}

        <button
          type="submit"
          disabled={loading || !submissionsOpen}
          className="rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige) disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </main>
  );
}
