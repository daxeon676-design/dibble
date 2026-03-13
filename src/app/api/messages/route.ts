import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

// GET /api/messages  — list all conversations for the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true, email: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(conversations);
}

const newConvSchema = z.object({
  recipientId: z.string(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
});

// POST /api/messages  — start a new conversation
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = newConvSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { recipientId, subject, body: messageBody } = parsed.data;

  if (recipientId === session.user.id) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  const conversation = await prisma.conversation.create({
    data: {
      subject: subject ?? null,
      participants: {
        create: [
          { userId: session.user.id },
          { userId: recipientId },
        ],
      },
      messages: {
        create: { senderId: session.user.id, body: messageBody },
      },
    },
  });

  return NextResponse.json(conversation, { status: 201 });
}
