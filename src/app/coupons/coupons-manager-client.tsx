"use client";

import { FormEvent, useState } from "react";

type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  amount: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  minOrderCents: number;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  usageCount: number;
  sellerId: string | null;
  createdAt: string;
};

type Props = {
  canAssignSeller: boolean;
  initialCoupons: Coupon[];
};

export default function CouponsManagerClient({ canAssignSeller, initialCoupons }: Props) {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [amount, setAmount] = useState("10");
  const [minOrder, setMinOrder] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [sellerId, setSellerId] = useState("");

  async function onCreateCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const amountValue =
      type === "PERCENT"
        ? Number(amount)
        : Math.max(1, Math.round(Number(amount) * 100));
    const minOrderValue = Math.max(0, Math.round(Number(minOrder || "0") * 100));
    const maxDiscountValue = maxDiscount ? Math.max(1, Math.round(Number(maxDiscount) * 100)) : null;
    const usageLimitValue = usageLimit ? Math.max(1, Math.trunc(Number(usageLimit))) : null;

    const payload: Record<string, unknown> = {
      code: code.trim().toUpperCase(),
      type,
      amount: amountValue,
      minOrderCents: minOrderValue,
      maxDiscountCents: maxDiscountValue,
      usageLimit: usageLimitValue,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    };

    if (canAssignSeller && sellerId.trim()) {
      payload.sellerId = sellerId.trim();
    }

    const response = await fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | { coupon?: Coupon; error?: string }
      | null;

    if (!response.ok || !body?.coupon) {
      setError(body?.error ?? "Could not create coupon.");
      setSaving(false);
      return;
    }

    setCode("");
    setAmount("10");
    setMinOrder("0");
    setMaxDiscount("");
    setUsageLimit("");
    setStartsAt("");
    setEndsAt("");
    setSellerId("");

    setCoupons((prev) => [body.coupon as Coupon, ...prev]);
    setSaving(false);
  }

  async function onToggleCoupon(id: string, active: boolean) {
    const response = await fetch(`/api/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });

    if (!response.ok) {
      setError("Could not update coupon state.");
      return;
    }

    setCoupons((prev) => prev.map((coupon) => (coupon.id === id ? { ...coupon, active } : coupon)));
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/30 p-4">
        <h2 className="text-lg font-semibold">Create coupon</h2>
        <form onSubmit={onCreateCoupon} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Code</span>
            <input
              required
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as "PERCENT" | "FIXED")}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
            >
              <option value="PERCENT">Percent</option>
              <option value="FIXED">Fixed (GBP)</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="font-medium">Amount</span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">Minimum order (GBP)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minOrder}
              onChange={(event) => setMinOrder(event.target.value)}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">Max discount (GBP)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxDiscount}
              onChange={(event) => setMaxDiscount(event.target.value)}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">Usage limit</span>
            <input
              type="number"
              min="1"
              step="1"
              value={usageLimit}
              onChange={(event) => setUsageLimit(event.target.value)}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">Starts at</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">Ends at</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
            />
          </label>

          {canAssignSeller ? (
            <label className="text-sm md:col-span-2">
              <span className="font-medium">Seller ID (optional, for seller-specific coupon)</span>
              <input
                value={sellerId}
                onChange={(event) => setSellerId(event.target.value)}
                className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-2"
              />
            </label>
          ) : null}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create coupon"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-(--accent-terra)/30 bg-white p-4">
        <h2 className="text-lg font-semibold">Existing coupons</h2>
        {coupons.length === 0 ? (
          <p className="mt-3 text-sm text-foreground/60">No coupons yet.</p>
        ) : null}

        {coupons.length > 0 ? (
          <div className="mt-3 space-y-2">
            {coupons.map((coupon) => (
              <article
                key={coupon.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-(--accent-terra)/20 p-3"
              >
                <div className="text-sm">
                  <p className="font-semibold">{coupon.code}</p>
                  <p className="text-foreground/70">
                    {coupon.type === "PERCENT" ? `${coupon.amount}% off` : `£${(coupon.amount / 100).toFixed(2)} off`} · Used {coupon.usageCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                  </p>
                  {coupon.sellerId ? (
                    <p className="text-xs text-foreground/60">Seller scoped: {coupon.sellerId}</p>
                  ) : (
                    <p className="text-xs text-foreground/60">Applies to all sellers</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void onToggleCoupon(coupon.id, !coupon.active)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${coupon.active ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                >
                  {coupon.active ? "Disable" : "Enable"}
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
