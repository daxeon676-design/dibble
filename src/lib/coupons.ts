import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type CouponType = "PERCENT" | "FIXED";

export type CouponRecord = {
  id: string;
  code: string;
  type: CouponType;
  amount: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  minOrderCents: number;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  usageCount: number;
  sellerId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const couponsPath = path.join(dataDir, "coupons.json");

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

async function readCoupons(): Promise<CouponRecord[]> {
  try {
    const raw = await fs.readFile(couponsPath, "utf8");
    const parsed = JSON.parse(raw) as CouponRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeCoupons(coupons: CouponRecord[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(couponsPath, JSON.stringify(coupons, null, 2), "utf8");
}

export async function listCoupons() {
  return readCoupons();
}

export async function listCouponsBySeller(sellerId: string) {
  const all = await readCoupons();
  return all.filter((coupon) => coupon.sellerId === sellerId);
}

export async function getCouponByCode(code: string) {
  const normalized = normalizeCode(code);
  const all = await readCoupons();
  return all.find((coupon) => normalizeCode(coupon.code) === normalized) ?? null;
}

export async function createCoupon(input: {
  code: string;
  type: CouponType;
  amount: number;
  minOrderCents?: number;
  maxDiscountCents?: number | null;
  usageLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  sellerId?: string | null;
  createdByUserId: string;
}) {
  const all = await readCoupons();
  const code = normalizeCode(input.code);

  if (all.some((coupon) => normalizeCode(coupon.code) === code)) {
    throw new Error("Coupon code already exists.");
  }

  const now = new Date().toISOString();
  const coupon: CouponRecord = {
    id: crypto.randomUUID(),
    code,
    type: input.type,
    amount: input.amount,
    active: true,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    minOrderCents: input.minOrderCents ?? 0,
    maxDiscountCents: input.maxDiscountCents ?? null,
    usageLimit: input.usageLimit ?? null,
    usageCount: 0,
    sellerId: input.sellerId ?? null,
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  };

  all.push(coupon);
  await writeCoupons(all);
  return coupon;
}

export async function toggleCouponActive(id: string, active: boolean) {
  const all = await readCoupons();
  const index = all.findIndex((coupon) => coupon.id === id);
  if (index < 0) {
    return null;
  }

  all[index] = { ...all[index], active, updatedAt: new Date().toISOString() };
  await writeCoupons(all);
  return all[index];
}

export async function incrementCouponUsage(id: string) {
  const all = await readCoupons();
  const index = all.findIndex((coupon) => coupon.id === id);
  if (index < 0) {
    return null;
  }

  all[index] = {
    ...all[index],
    usageCount: all[index].usageCount + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeCoupons(all);
  return all[index];
}

export function evaluateCoupon(
  coupon: CouponRecord,
  input: { subtotalCents: number; sellerIds: string[]; now?: Date },
) {
  const now = input.now ?? new Date();
  if (!coupon.active) {
    return { ok: false as const, error: "Coupon is inactive." };
  }

  if (coupon.startsAt) {
    const starts = new Date(coupon.startsAt);
    if (!Number.isNaN(starts.getTime()) && starts.getTime() > now.getTime()) {
      return { ok: false as const, error: "Coupon is not active yet." };
    }
  }

  if (coupon.endsAt) {
    const ends = new Date(coupon.endsAt);
    if (!Number.isNaN(ends.getTime()) && ends.getTime() < now.getTime()) {
      return { ok: false as const, error: "Coupon has expired." };
    }
  }

  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false as const, error: "Coupon usage limit reached." };
  }

  if (input.subtotalCents < coupon.minOrderCents) {
    return { ok: false as const, error: "Order does not meet coupon minimum." };
  }

  if (coupon.sellerId && !input.sellerIds.includes(coupon.sellerId)) {
    return { ok: false as const, error: "Coupon does not apply to these items." };
  }

  let discountCents =
    coupon.type === "PERCENT"
      ? Math.round(input.subtotalCents * (coupon.amount / 100))
      : Math.round(coupon.amount);

  if (coupon.maxDiscountCents !== null) {
    discountCents = Math.min(discountCents, coupon.maxDiscountCents);
  }

  discountCents = Math.max(0, Math.min(discountCents, input.subtotalCents));

  return {
    ok: true as const,
    discountCents,
  };
}
