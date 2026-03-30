import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { dispatchOpsAlert } from "@/lib/ops-alert-dispatcher";

export async function POST() {
  try {
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

    if (!result.delivered) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ops alert webhook did not accept delivery.",
          dispatch: result,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, dispatch: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected ops alert test error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
