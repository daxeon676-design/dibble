import { NextResponse } from "next/server";

import { getSiteConfig } from "@/lib/site-config";

export async function GET() {
  const config = await getSiteConfig();
  return NextResponse.json({
    categories: config.categories,
    deliveryOptions: config.deliveryOptions.filter((opt) => opt.enabled),
    homepageTagline: config.homepageTagline,
    footerDescription: config.footerDescription,
  });
}
