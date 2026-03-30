import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const products = await prisma.product.findMany({
    where: { sellerId: userId },
    select: {
      id: true,
      title: true,
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const toDelete = products.filter((p) => p._count.orderItems === 0);
  const toDelist = products.filter((p) => p._count.orderItems > 0);

  return NextResponse.json({
    user,
    impact: {
      deleteCount: toDelete.length,
      delistCount: toDelist.length,
      sampleDeleteTitles: toDelete.slice(0, 8).map((p) => p.title),
      sampleDelistTitles: toDelist.slice(0, 8).map((p) => p.title),
    },
  });
}
