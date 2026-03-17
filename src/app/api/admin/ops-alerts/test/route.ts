import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { dispatchOpsAlert } from "@/lib/ops-alert-dispatcher";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await dispatchOpsAlert({
    source: "manual",
    severity: "warn",
    title: "Manual ops alert test",
    message: "Admin-triggered alert routing test.",
    context: {
      triggeredBy: session.user.id,
      triggeredAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true, dispatch: result });
}
