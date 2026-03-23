import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  getSellerDeliverySettingsMap,
  setSellerDeliverySettings,
  getSiteConfig,
} from "@/lib/site-config";

const payloadSchema = z.object({
  optionIds: z.array(z.string()),
  customCostsPence: z.record(z.string(), z.number().int().min(0)).default({}),
  freeDeliveryThresholdPence: z.number().int().min(0).default(0),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const map = await getSellerDeliverySettingsMap();
  const config = await getSiteConfig();
  const defaultOptionIds = config.deliveryOptions.filter((o) => o.enabled).map((o) => o.id);
  const current = map[session.user.id] ?? {
    optionIds: defaultOptionIds,
    customCostsPence: {},
    freeDeliveryThresholdPence: 0,
  };

  const selected = current.optionIds.length > 0 ? current.optionIds : defaultOptionIds;

  return NextResponse.json({
    selected,
    available: config.deliveryOptions.filter((o) => o.enabled),
    customCostsPence: current.customCostsPence,
    freeDeliveryThresholdPence: current.freeDeliveryThresholdPence,
  });
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

  await setSellerDeliverySettings(session.user.id, {
    optionIds: parsed.data.optionIds,
    customCostsPence: parsed.data.customCostsPence,
    freeDeliveryThresholdPence: parsed.data.freeDeliveryThresholdPence,
  });
  return NextResponse.json({ ok: true });
}
