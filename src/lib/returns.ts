import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";

export type ReturnRequestStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "REFUNDED"
  | "CLOSED";

export type ReturnRequest = {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  details: string;
  status: ReturnRequestStatus;
  requestedAt: string;
  updatedAt: string;
  requestedByIp?: string;
  resolutionNote?: string;
  reviewedById?: string;
  reviewedAt?: string;
  rmaCode: string;
};

const dataDir = path.join(process.cwd(), "data");
const returnsPath = path.join(dataDir, "returns.json");
const validStatuses: ReturnRequestStatus[] = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "REFUNDED",
  "CLOSED",
];

let legacyImportPromise: Promise<void> | null = null;

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function createRmaCode(orderId: string) {
  const orderSlice = orderId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RMA-${orderSlice}-${suffix}`;
}

function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const asDate = new Date(value);
  return Number.isNaN(asDate.getTime()) ? undefined : asDate.toISOString();
}

function toReturnRequest(row: {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  details: string;
  status: string;
  requestedAt: Date;
  updatedAt: Date;
  requestedByIp: string | null;
  resolutionNote: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rmaCode: string;
}): ReturnRequest {
  return {
    id: row.id,
    orderId: row.orderId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    reason: row.reason,
    details: row.details,
    status: row.status as ReturnRequestStatus,
    requestedAt: row.requestedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requestedByIp: row.requestedByIp ?? undefined,
    resolutionNote: row.resolutionNote ?? undefined,
    reviewedById: row.reviewedById ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    rmaCode: row.rmaCode,
  };
}

async function importLegacyRowsIfNeeded() {
  const existingCount = await prisma.returnRequest.count();
  if (existingCount > 0) {
    return;
  }

  const legacyRows = await readJsonFile<ReturnRequest[]>(returnsPath, []);
  if (legacyRows.length === 0) {
    return;
  }

  const rowsToImport = legacyRows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    reason: row.reason,
    details: row.details,
    status: validStatuses.includes(row.status) ? row.status : "REQUESTED",
    requestedAt: toIsoString(row.requestedAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt) ?? new Date().toISOString(),
    requestedByIp: row.requestedByIp ?? null,
    resolutionNote: row.resolutionNote ?? null,
    reviewedById: row.reviewedById ?? null,
    reviewedAt: toIsoString(row.reviewedAt) ?? null,
    rmaCode: row.rmaCode || createRmaCode(row.orderId),
  }));

  await prisma.$transaction(async (tx) => {
    for (const row of rowsToImport) {
      const exists = await tx.returnRequest.findUnique({ where: { id: row.id }, select: { id: true } });
      if (exists) continue;
      await tx.returnRequest.create({
        data: {
          id: row.id,
          orderId: row.orderId,
          buyerId: row.buyerId,
          sellerId: row.sellerId,
          reason: row.reason,
          details: row.details,
          status: row.status as ReturnRequestStatus,
          requestedAt: new Date(row.requestedAt),
          updatedAt: new Date(row.updatedAt),
          requestedByIp: row.requestedByIp,
          resolutionNote: row.resolutionNote,
          reviewedById: row.reviewedById,
          reviewedAt: row.reviewedAt ? new Date(row.reviewedAt) : null,
          rmaCode: row.rmaCode,
        },
      });
    }
  });

  // Keep a backup and avoid repeated import attempts after a successful migration.
  await writeJsonFile(path.join(dataDir, "returns.migrated.backup.json"), legacyRows).catch(() => undefined);
  await fs.unlink(returnsPath).catch(() => undefined);
}

async function ensureLegacyImport() {
  if (!legacyImportPromise) {
    legacyImportPromise = importLegacyRowsIfNeeded().catch((error) => {
      legacyImportPromise = null;
      throw error;
    });
  }
  await legacyImportPromise;
}

export async function listReturnRequests(): Promise<ReturnRequest[]> {
  await ensureLegacyImport();
  const rows = await prisma.returnRequest.findMany({
    orderBy: { requestedAt: "desc" },
  });
  return rows.map(toReturnRequest);
}

export async function getReturnRequestById(id: string): Promise<ReturnRequest | null> {
  await ensureLegacyImport();
  const row = await prisma.returnRequest.findUnique({ where: { id } });
  return row ? toReturnRequest(row) : null;
}

export async function createReturnRequest(input: {
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  details: string;
  requestedByIp?: string;
}): Promise<ReturnRequest> {
  await ensureLegacyImport();
  const nowIso = new Date().toISOString();

  const created = await prisma.returnRequest.create({
    data: {
      id: crypto.randomUUID(),
      orderId: input.orderId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      reason: input.reason,
      details: input.details,
      status: "REQUESTED",
      requestedAt: new Date(nowIso),
      updatedAt: new Date(nowIso),
      requestedByIp: input.requestedByIp ?? null,
      rmaCode: createRmaCode(input.orderId),
    },
  });

  return toReturnRequest(created);
}

export async function updateReturnRequest(
  id: string,
  patch: Partial<Pick<ReturnRequest, "status" | "resolutionNote" | "reviewedById" | "reviewedAt">>,
): Promise<ReturnRequest | null> {
  await ensureLegacyImport();
  const existing = await prisma.returnRequest.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.resolutionNote !== undefined ? { resolutionNote: patch.resolutionNote ?? null } : {}),
      ...(patch.reviewedById !== undefined ? { reviewedById: patch.reviewedById ?? null } : {}),
      ...(patch.reviewedAt !== undefined
        ? { reviewedAt: patch.reviewedAt ? new Date(patch.reviewedAt) : null }
        : {}),
      updatedAt: new Date(),
    },
  });

  return toReturnRequest(updated);
}

export function hasOpenReturnForOrder(rows: ReturnRequest[], orderId: string) {
  return rows.some(
    (row) =>
      row.orderId === orderId &&
      row.status !== "REJECTED" &&
      row.status !== "REFUNDED" &&
      row.status !== "CLOSED",
  );
}
