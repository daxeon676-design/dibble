import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sellerId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== Role.BUYER) {
    return NextResponse.json({ error: "Only buyer accounts can follow shops." }, { status: 403 });
  }

  const { sellerId } = await params;

  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, role: true },
  });

  if (!seller || seller.role !== Role.SELLER) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  if (seller.id === session.user.id) {
    return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
  }

  await prisma.sellerFollow.upsert({
    where: {
      sellerId_buyerId: {
        sellerId,
        buyerId: session.user.id,
      },
    },
    update: {},
    create: {
      sellerId,
      buyerId: session.user.id,
    },
  });

  const followers = await prisma.sellerFollow.count({ where: { sellerId } });
  return NextResponse.json({ ok: true, followers });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sellerId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sellerId } = await params;

  await prisma.sellerFollow.deleteMany({
    where: {
      sellerId,
      buyerId: session.user.id,
    },
  });

  const followers = await prisma.sellerFollow.count({ where: { sellerId } });
  return NextResponse.json({ ok: true, followers });
}
