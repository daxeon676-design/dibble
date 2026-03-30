import fs from "node:fs/promises";
import path from "node:path";

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

export async function listReturnRequests(): Promise<ReturnRequest[]> {
  const rows = await readJsonFile<ReturnRequest[]>(returnsPath, []);
  return rows.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
}

export async function getReturnRequestById(id: string): Promise<ReturnRequest | null> {
  const rows = await listReturnRequests();
  return rows.find((row) => row.id === id) ?? null;
}

export async function createReturnRequest(input: {
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  details: string;
  requestedByIp?: string;
}): Promise<ReturnRequest> {
  const rows = await listReturnRequests();
  const nowIso = new Date().toISOString();

  const next: ReturnRequest = {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    reason: input.reason,
    details: input.details,
    status: "REQUESTED",
    requestedAt: nowIso,
    updatedAt: nowIso,
    requestedByIp: input.requestedByIp,
    rmaCode: createRmaCode(input.orderId),
  };

  rows.unshift(next);
  await writeJsonFile(returnsPath, rows);
  return next;
}

export async function updateReturnRequest(
  id: string,
  patch: Partial<Pick<ReturnRequest, "status" | "resolutionNote" | "reviewedById" | "reviewedAt">>,
): Promise<ReturnRequest | null> {
  const rows = await listReturnRequests();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) {
    return null;
  }

  const existing = rows[index];
  const next: ReturnRequest = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  rows[index] = next;
  await writeJsonFile(returnsPath, rows);
  return next;
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
