import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ conversationId: string }> };

// GET /api/messages/[conversationId]  — load full thread + mark as read
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  // Verify the user is a participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  });
  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark as read
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    data: { readAt: new Date() },
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true, email: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, displayName: true, email: true } } },
      },
    },
  });

  return NextResponse.json(conversation);
}

const replySchema = z.object({ body: z.string().min(1).max(5000) });

// POST /api/messages/[conversationId]  — reply
export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  });
  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: session.user.id, body: parsed.data.body },
      include: { sender: { select: { id: true, displayName: true, email: true } } },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
    // reset readAt for other participants so they see unread indicator
    prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: { not: session.user.id } },
      data: { readAt: null },
    }),
  ]);

  return NextResponse.json(message, { status: 201 });
}
