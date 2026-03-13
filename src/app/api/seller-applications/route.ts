import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Role, SellerApplicationStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createApplicationSchema = z.object({
  shopName: z.string().trim().min(3).max(80),
  description: z.string().trim().min(20).max(1000),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const application = await prisma.sellerApplication.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      shopName: true,
      description: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNotes: true,
    },
  });

  return NextResponse.json({ application });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.BUYER) {
    return NextResponse.json(
      { error: "Only buyers can submit seller applications." },
      { status: 403 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createApplicationSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid application payload." }, { status: 400 });
  }

  const existing = await prisma.sellerApplication.findUnique({ where: { userId: session.user.id } });
  if (existing) {
    return NextResponse.json({ error: "You already submitted a seller application." }, { status: 409 });
  }

  try {
    const application = await prisma.sellerApplication.create({
      data: {
        userId: session.user.id,
        shopName: parsed.data.shopName,
        description: parsed.data.description,
        status: SellerApplicationStatus.PENDING,
      },
      select: {
        id: true,
        shopName: true,
        status: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to submit application. Shop name may already be in use." },
      { status: 409 },
    );
  }
}
