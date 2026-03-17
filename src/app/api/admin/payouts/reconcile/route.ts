import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { dispatchOpsAlert } from "@/lib/ops-alert-dispatcher";
import { reconcileSellerPayouts } from "@/lib/payout-reconciliation";
import { saveReconciliationReport } from "@/lib/reconciliation-report-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await reconcileSellerPayouts();
  await saveReconciliationReport({
    generatedAt: result.generatedAt,
    source: "admin_api",
    summary: result.summary,
    issuesPreview: result.issues.slice(0, 25),
  });

  if (result.summary.issuesCount > 0) {
    logApiEvent("warn", "admin.payouts.reconcile.issues_found", {
      issuesCount: result.summary.issuesCount,
      scanned: result.summary.scanned,
    });

    await dispatchOpsAlert({
      source: "admin_api",
      severity: "warn",
      title: "Admin reconciliation run found issues",
      message: `${result.summary.issuesCount} reconciliation issue(s) detected.`,
      context: {
        generatedAt: result.generatedAt,
        scanned: result.summary.scanned,
        issueTypes: [...new Set(result.issues.map((issue) => issue.type))],
      },
    });
  } else {
    logApiEvent("info", "admin.payouts.reconcile.clean", {
      scanned: result.summary.scanned,
    });
  }

  return NextResponse.json(result);
}
