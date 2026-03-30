import fs from "node:fs/promises";
import path from "node:path";

export type SellerPayoutStatus = "PLATFORM_PENDING" | "PAID_OUT" | "SPLIT_AT_CHARGE" | "CANCELLED";

export type SellerPayoutEntry = {
  orderId: string;
  sellerId: string;
  grossCents: number;
  platformFeeCents: number;
  sellerPayoutCents: number;
  status: SellerPayoutStatus;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  payoutReference?: string;
  stripeTransferId?: string;
};

type SellerPayoutMap = Record<string, SellerPayoutEntry>;

const dataDir = path.join(process.cwd(), "data");
const ledgerPath = path.join(dataDir, "seller-payouts.json");

function isReadonlyFilesystemError(error: unknown) {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  const code = String((error as NodeJS.ErrnoException).code ?? "").toUpperCase();
  return code === "EROFS" || code === "EPERM" || code === "EACCES";
}

async function readLedger(): Promise<SellerPayoutMap> {
  try {
    const raw = await fs.readFile(ledgerPath, "utf8");
    const parsed = JSON.parse(raw) as SellerPayoutMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeLedger(next: SellerPayoutMap) {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(ledgerPath, JSON.stringify(next, null, 2), "utf8");
  } catch (error) {
    if (isReadonlyFilesystemError(error)) {
      console.warn("[seller-payout-ledger] Skipping ledger write on read-only filesystem.");
      return;
    }

    throw error;
  }
}

export async function upsertSellerPayout(entry: Omit<SellerPayoutEntry, "createdAt" | "updatedAt">) {
  const ledger = await readLedger();
  const existing = ledger[entry.orderId];
  const now = new Date().toISOString();
  const mergedStatus = existing?.status === "PAID_OUT" ? existing.status : entry.status;

  ledger[entry.orderId] = {
    ...entry,
    status: mergedStatus,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    paidAt: entry.paidAt ?? existing?.paidAt,
    cancelledAt: entry.cancelledAt ?? existing?.cancelledAt,
    cancellationReason: entry.cancellationReason ?? existing?.cancellationReason,
    payoutReference: entry.payoutReference ?? existing?.payoutReference,
    stripeTransferId: entry.stripeTransferId ?? existing?.stripeTransferId,
  };

  await writeLedger(ledger);
  return ledger[entry.orderId];
}

export async function markSellerPayoutPaid(orderId: string, payoutReference?: string) {
  const ledger = await readLedger();
  const current = ledger[orderId];
  if (!current) return null;

  const now = new Date().toISOString();
  const next: SellerPayoutEntry = {
    ...current,
    status: "PAID_OUT",
    paidAt: now,
    payoutReference: payoutReference?.trim() || current.payoutReference,
    updatedAt: now,
  };

  ledger[orderId] = next;
  await writeLedger(ledger);
  return next;
}

export async function markSellerPayoutPaidWithTransfer(orderId: string, stripeTransferId: string) {
  const ledger = await readLedger();
  const current = ledger[orderId];
  if (!current) return null;

  const now = new Date().toISOString();
  const next: SellerPayoutEntry = {
    ...current,
    status: "PAID_OUT",
    paidAt: now,
    payoutReference: stripeTransferId,
    stripeTransferId,
    updatedAt: now,
  };

  ledger[orderId] = next;
  await writeLedger(ledger);
  return next;
}

export async function cancelSellerPayout(orderId: string, cancellationReason?: string) {
  const ledger = await readLedger();
  const current = ledger[orderId];
  if (!current || current.status === "PAID_OUT") return current ?? null;

  const now = new Date().toISOString();
  const next: SellerPayoutEntry = {
    ...current,
    status: "CANCELLED",
    cancelledAt: now,
    cancellationReason: cancellationReason?.trim() || current.cancellationReason,
    updatedAt: now,
  };

  ledger[orderId] = next;
  await writeLedger(ledger);
  return next;
}

export async function getSellerPayout(orderId: string) {
  const ledger = await readLedger();
  return ledger[orderId] ?? null;
}

export async function listSellerPayouts() {
  const ledger = await readLedger();
  return Object.values(ledger).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
