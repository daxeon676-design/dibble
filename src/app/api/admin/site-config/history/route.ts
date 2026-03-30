import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getConfigHistory, saveSiteConfig, appendConfigHistory, getSiteConfig } from "@/lib/site-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const history = await getConfigHistory();
  return NextResponse.json(history);
}

const rollbackSchema = z.object({ index: z.number().int().min(0) });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = rollbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const history = await getConfigHistory();
  const entry = history[parsed.data.index];
  if (!entry) {
    return NextResponse.json({ error: "History entry not found" }, { status: 404 });
  }

  // Save current state as a history entry before rolling back
  const current = await getSiteConfig();
  await appendConfigHistory({
    savedAt: new Date().toISOString(),
    savedBy: `${session.user.email ?? "unknown"} (rollback)`,
    config: current,
  });

  await saveSiteConfig(entry.config);
  return NextResponse.json({ ok: true, restoredFrom: entry.savedAt });
}
