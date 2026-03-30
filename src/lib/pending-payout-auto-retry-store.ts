import fs from "node:fs/promises";
import path from "node:path";

import type { PendingPayoutAutoRetryResult } from "@/lib/pending-payout-auto-retry";

export type StoredPendingPayoutAutoRetryReport = PendingPayoutAutoRetryResult & {
  generatedAt: string;
  source: "cron" | "manual";
};

const dataDir = path.join(process.cwd(), "data");
const reportPath = path.join(dataDir, "pending-payout-auto-retry-last-run.json");

function isReadonlyFilesystemError(error: unknown) {
  if (!(error instanceof Error) || !("code" in error)) return false;
  const code = String((error as NodeJS.ErrnoException).code ?? "").toUpperCase();
  return code === "EROFS" || code === "EPERM" || code === "EACCES";
}

export async function savePendingPayoutAutoRetryReport(report: StoredPendingPayoutAutoRetryReport) {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  } catch (error) {
    if (isReadonlyFilesystemError(error)) {
      return;
    }
    throw error;
  }
}

export async function getLastPendingPayoutAutoRetryReport(): Promise<StoredPendingPayoutAutoRetryReport | null> {
  try {
    const raw = await fs.readFile(reportPath, "utf8");
    const parsed = JSON.parse(raw) as StoredPendingPayoutAutoRetryReport;
    return parsed ?? null;
  } catch {
    return null;
  }
}
