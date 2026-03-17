import { NextResponse } from "next/server";

import { logApiEvent } from "@/lib/observability";
import { dispatchOpsAlert } from "@/lib/ops-alert-dispatcher";
import { reconcileSellerPayouts } from "@/lib/payout-reconciliation";
import { saveReconciliationReport } from "@/lib/reconciliation-report-store";

function isAuthorized(request: Request) {
  const expectedSecret = process.env.OPS_CRON_SECRET;
  if (!expectedSecret) return false;

  const header = request.headers.get("x-ops-secret") ?? "";
  return header.length > 0 && header === expectedSecret;
}

function isVercelCronAuthorized(request: Request) {
  const expectedSecret = process.env.OPS_CRON_SECRET;
  if (!expectedSecret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${expectedSecret}`;
}

async function runReconciliation() {
  const result = await reconcileSellerPayouts();
  await saveReconciliationReport({
    generatedAt: result.generatedAt,
    source: "cron",
    summary: result.summary,
    issuesPreview: result.issues.slice(0, 25),
  });

  if (result.summary.issuesCount > 0) {
    logApiEvent("warn", "ops.daily_reconciliation.issues_found", {
      issuesCount: result.summary.issuesCount,
      scanned: result.summary.scanned,
      generatedAt: result.generatedAt,
    });

    await dispatchOpsAlert({
      source: "cron",
      severity: "critical",
      title: "Daily reconciliation detected payout issues",
      message: `${result.summary.issuesCount} reconciliation issue(s) detected.`,
      context: {
        generatedAt: result.generatedAt,
        scanned: result.summary.scanned,
        pendingCount: result.summary.pendingCount,
        issueTypes: [...new Set(result.issues.map((issue) => issue.type))],
      },
    });
  } else {
    logApiEvent("info", "ops.daily_reconciliation.clean", {
      scanned: result.summary.scanned,
      generatedAt: result.generatedAt,
    });
  }

  return result;
}

// POST: manual trigger from admin UI (x-ops-secret header)
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReconciliation();
  return NextResponse.json(result);
}

// GET: Vercel Cron trigger (Authorization: Bearer <OPS_CRON_SECRET>)
export async function GET(request: Request) {
  if (!isVercelCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReconciliation();
  return NextResponse.json(result);
}
