import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  orderId: z.string(),
  reason: z.string().min(5).max(200),
  details: z.string().min(10).max(2000),
});

// POST /api/disputes  — buyer raises a dispute
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { orderId, reason, details } = parsed.data;

  // Verify the order belongs to this buyer
  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerId: session.user.id },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Only one dispute per order
  const existing = await prisma.dispute.findUnique({ where: { orderId } });
  if (existing) return NextResponse.json({ error: "A dispute already exists for this order" }, { status: 409 });

  const dispute = await prisma.dispute.create({
    data: { orderId, raisedById: session.user.id, reason, details },
  });

  return NextResponse.json(dispute, { status: 201 });
}

// GET /api/disputes  — buyer sees their own disputes; admin sees all
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = session.user.role === "ADMIN" ? {} : { raisedById: session.user.id };

  const disputes = await prisma.dispute.findMany({
    where,
    include: {
      order: { select: { id: true, totalCents: true, createdAt: true } },
      raisedBy: { select: { id: true, email: true, displayName: true } },
      resolvedBy: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(disputes);
}
