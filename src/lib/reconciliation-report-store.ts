import fs from "node:fs/promises";
import path from "node:path";

import type { ReconciliationIssue, ReconciliationSummary } from "@/lib/payout-reconciliation";

export type StoredReconciliationReport = {
  generatedAt: string;
  source: "manual" | "admin_api" | "cron";
  summary: ReconciliationSummary;
  issuesPreview: ReconciliationIssue[];
};

const dataDir = path.join(process.cwd(), "data");
const reportPath = path.join(dataDir, "reconciliation-last-run.json");

export async function saveReconciliationReport(report: StoredReconciliationReport) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
}

export async function getLastReconciliationReport(): Promise<StoredReconciliationReport | null> {
  try {
    const raw = await fs.readFile(reportPath, "utf8");
    const parsed = JSON.parse(raw) as StoredReconciliationReport;
    return parsed ?? null;
  } catch {
    return null;
  }
}
