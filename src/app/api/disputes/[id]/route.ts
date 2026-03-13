import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

// GET /api/disputes/[id]
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      order: { select: { id: true, totalCents: true, createdAt: true } },
      raisedBy: { select: { id: true, email: true, displayName: true } },
      resolvedBy: { select: { id: true, email: true, displayName: true } },
    },
  });

  if (!dispute) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the buyer who raised it or an admin can view
  if (dispute.raisedById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(dispute);
}

const updateSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "CLOSED"]),
  resolution: z.string().max(2000).optional(),
});

// PATCH /api/disputes/[id]  — admin only
export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const dispute = await prisma.dispute.update({
    where: { id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.resolution && { resolution: parsed.data.resolution }),
      ...(parsed.data.status === "RESOLVED" && { resolvedById: session.user.id }),
    },
  });

  return NextResponse.json(dispute);
}
