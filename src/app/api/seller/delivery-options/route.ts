import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getSellerDeliveryOptionsMap, setSellerDeliveryOptions, getSiteConfig } from "@/lib/site-config";

const payloadSchema = z.object({ optionIds: z.array(z.string()) });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const map = await getSellerDeliveryOptionsMap();
  const config = await getSiteConfig();
  const selected = map[session.user.id] ?? config.deliveryOptions.filter((o) => o.enabled).map((o) => o.id);

  return NextResponse.json({ selected, available: config.deliveryOptions.filter((o) => o.enabled) });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await setSellerDeliveryOptions(session.user.id, parsed.data.optionIds);
  return NextResponse.json({ ok: true });
}
