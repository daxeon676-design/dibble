import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getLegalPagesContent, saveLegalPagesContent } from "@/lib/legal-pages";

const faqItemSchema = z.object({
  q: z.string().trim().min(1),
  a: z.string().trim().min(1),
});

const sectionSchema = z.object({
  heading: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

const legalPagesSchema = z.object({
  about: z.object({
    title: z.string().trim().min(1),
    subtitle: z.string().trim().min(1),
    body: z.string().trim().min(1),
    contactEmail: z.string().email(),
  }),
  faq: z.object({
    title: z.string().trim().min(1),
    intro: z.string().trim().min(1),
    contactEmail: z.string().email(),
    items: z.array(faqItemSchema).min(1),
  }),
  terms: z.object({
    title: z.string().trim().min(1),
    lastUpdated: z.string().trim().min(1),
    sections: z.array(sectionSchema).min(1),
  }),
  privacy: z.object({
    title: z.string().trim().min(1),
    lastUpdated: z.string().trim().min(1),
    sections: z.array(sectionSchema).min(1),
  }),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const content = await getLegalPagesContent();
  return NextResponse.json(content);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = legalPagesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await saveLegalPagesContent(parsed.data);
  return NextResponse.json({ ok: true });
}
